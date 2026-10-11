process.env.JWT_SECRET ??= 'formulai-test-jwt-secret';
process.env.JWT_EXPIRES_IN ??= '7d';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/formulai';
process.env.REDIS_HOST ??= '127.0.0.1';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcryptjs';
import { Types, type Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { User, UserDocument } from '../src/schemas/user.schema';
import { Form, FormDocument } from '../src/schemas/form.schema';
import { Response, ResponseDocument } from '../src/schemas/response.schema';
import { Project, ProjectDocument } from '../src/schemas/project.schema';
import { AnalyticsService } from '../src/forms/analytics.service';
import { collectMigrationRoutes, instantiatePath } from './form-scoped-routes';

describe('Security hardening (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let formModel: Model<FormDocument>;
  let responseModel: Model<ResponseDocument>;
  let projectModel: Model<ProjectDocument>;
  let analyticsService: AnalyticsService;

  const password = 'TestPassword123!';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerEmail = `e2e-hard-owner-${suffix}@example.com`;
  const attackerEmail = `e2e-hard-attacker-${suffix}@example.com`;
  const adminEmail = `e2e-hard-admin-${suffix}@example.com`;

  let tokenA: string;
  let tokenB: string;
  let tokenAdmin: string;
  let formAId: string;
  let formBId: string;
  let responseBId: string;
  let projectBId: string;
  let taskAId: string;

  async function createVerifiedUser(email: string, roles: string[]) {
    const hashed = await bcrypt.hash(password, 10);
    return userModel.create({
      email,
      password: hashed,
      firstName: 'E2E',
      lastName: 'Hardening',
      isEmailVerified: true,
      roles,
    });
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const token = (res.body as { token?: string }).token;
    expect(token).toBeDefined();
    return token as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    userModel = moduleFixture.get(getModelToken(User.name));
    formModel = moduleFixture.get(getModelToken(Form.name));
    responseModel = moduleFixture.get(getModelToken(Response.name));
    projectModel = moduleFixture.get(getModelToken(Project.name));
    analyticsService = moduleFixture.get(AnalyticsService);

    const owner = await createVerifiedUser(ownerEmail, ['user']);
    const attacker = await createVerifiedUser(attackerEmail, ['user']);
    await createVerifiedUser(adminEmail, ['user', 'admin']);
    tokenA = await login(ownerEmail);
    tokenB = await login(attackerEmail);
    tokenAdmin = await login(adminEmail);

    const formA = await formModel.create({
      title: 'Owner form',
      createdBy: owner._id,
      questions: [],
      isActive: true,
      isPublic: true,
      settings: {
        allowMultipleResponses: true,
        requireLogin: false,
        showProgressBar: true,
      },
    });
    formAId = String(formA._id);

    const projectB = await projectModel.create({
      name: 'Attacker project',
      ownerId: attacker._id,
      type: 'single',
      status: 'designing',
      variants: [],
    });
    projectBId = String(projectB._id);

    const formB = await formModel.create({
      title: 'Attacker form',
      createdBy: attacker._id,
      projectId: projectB._id,
      questions: [],
      isActive: true,
      isPublic: true,
      settings: {
        allowMultipleResponses: true,
        requireLogin: false,
        showProgressBar: true,
      },
    });
    formBId = String(formB._id);

    const responseB = await responseModel.create({
      formId: formB._id,
      respondentEmail: `resp-b-${suffix}@example.com`,
      answers: [{ questionId: 'q1', value: 'private answer' }],
      submittedAt: new Date(),
      metadata: {
        hasTextContent: true,
        processedForAnalytics: false,
        extractedKeywords: [],
      },
    });
    responseBId = String(responseB._id);

    taskAId = analyticsService.getOrCreateAnalyticsTask(formAId).taskId;
  }, 90000);

  afterAll(async () => {
    if (formAId) {
      await responseModel.deleteMany({ formId: new Types.ObjectId(formAId) }).exec();
      await formModel.deleteOne({ _id: new Types.ObjectId(formAId) }).exec();
    }
    if (formBId) {
      await responseModel.deleteMany({ formId: new Types.ObjectId(formBId) }).exec();
      await formModel.deleteOne({ _id: new Types.ObjectId(formBId) }).exec();
    }
    if (projectBId) {
      await projectModel.deleteOne({ _id: new Types.ObjectId(projectBId) }).exec();
    }
    if (userModel) {
      await userModel
        .deleteMany({ email: { $in: [ownerEmail, attackerEmail, adminEmail] } })
        .exec();
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  it('returns only the caller\'s own forms from GET /forms', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/forms')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const ids = (res.body as Array<{ _id?: string }>).map((form) => String(form._id));
    expect(ids).toContain(formBId);
    expect(ids).not.toContain(formAId);
  });

  it('refuses another user\'s responseId on reprocess', async () => {
    await request(app.getHttpServer())
      .post(`/api/forms/${formAId}/responses/${responseBId}/reprocess`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('refuses a taskId that belongs to another form', async () => {
    await request(app.getHttpServer())
      .get(`/api/forms/${formBId}/analytics/task/${taskAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('refuses another user\'s projectId on form create and update', async () => {
    await request(app.getHttpServer())
      .post('/api/forms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Hijack project', projectId: projectBId })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/forms/${formAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ projectId: projectBId })
      .expect(404);
  });

  it('returns 401 on /migrations/* without a token', async () => {
    for (const route of collectMigrationRoutes(app)) {
      const path = instantiatePath(route.path, {});
      const req = request(app.getHttpServer())[
        route.method.toLowerCase() as 'get' | 'post'
      ](path);
      if (route.method !== 'GET') {
        req.send({});
      }
      const res = await req;
      expect(res.status).toBe(401);
    }
  });

  describe('Bull Board /api/admin/queues', () => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/admin/queues').expect(401);
    });

    it('returns 403 for a non-admin', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/queues')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('returns 200 for an admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/queues')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .redirects(1);
      expect(res.status).toBe(200);
    });

    it('returns 401 on a sub-path without a token', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/queues/api/queues')
        .expect(401);
    });
  });
});
