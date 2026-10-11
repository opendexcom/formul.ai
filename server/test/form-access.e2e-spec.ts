process.env.JWT_SECRET ??= 'your-secret-key';
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
import {
  collectFormScopedRoutes,
  collectMigrationRoutes,
  instantiatePath,
  isDeleteRoute,
  isStreamingRoute,
  type HttpRoute,
} from './form-scoped-routes';

/**
 * P0 E2E: authenticated management routes are owner-only even when the form
 * is public. User B (logged in, knows the public form id) must get 403/404
 * on every form-scoped route. Owner A still gets 200. Migrations are admin-only.
 */
describe('Form access IDOR (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let formModel: Model<FormDocument>;
  let responseModel: Model<ResponseDocument>;

  const password = 'TestPassword123!';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerEmail = `e2e-owner-${suffix}@example.com`;
  const attackerEmail = `e2e-attacker-${suffix}@example.com`;

  let tokenA: string;
  let tokenB: string;
  let formId: string;
  let deleteFormId: string;
  let responseId: string;
  let formScopedRoutes: HttpRoute[];
  let migrationRoutes: HttpRoute[];

  const ownerEmailLeak = ownerEmail;
  const respondentEmail = `respondent-${suffix}@example.com`;

  async function createVerifiedUser(email: string, roles: string[] = ['user']) {
    const hashed = await bcrypt.hash(password, 10);
    return userModel.create({
      email,
      password: hashed,
      firstName: 'E2E',
      lastName: email.startsWith('e2e-owner') ? 'Owner' : 'Attacker',
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

  function requestBodyFor(route: HttpRoute): Record<string, unknown> | undefined {
    if (route.method === 'PATCH' && route.path === '/forms/{id}') {
      return { description: 'e2e owner description' };
    }
    if (route.method === 'POST' && route.path.endsWith('/send-invitations')) {
      return { emails: [], subject: 'Invite', message: 'Please fill {formUrl}' };
    }
    return undefined;
  }

  function hit(
    route: HttpRoute,
    token: string,
    ids: Record<string, string>,
  ) {
    const path = instantiatePath(route.path, ids);
    const req = request(app.getHttpServer())
      [route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete'](path)
      .set('Authorization', `Bearer ${token}`);
    const body = requestBodyFor(route);
    if (body) {
      req.send(body);
    }
    return req;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'your-secret-key';
    process.env.JWT_EXPIRES_IN ??= '7d';
    process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/formulai';
    process.env.REDIS_HOST ??= '127.0.0.1';

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

    const owner = await createVerifiedUser(ownerEmail);
    await createVerifiedUser(attackerEmail);
    tokenA = await login(ownerEmail);
    tokenB = await login(attackerEmail);

    const form = await formModel.create({
      title: 'Public IDOR survey',
      description: 'Owner analytics must stay private',
      createdBy: owner._id,
      questions: [
        {
          id: 'q1',
          title: 'How was it?',
          type: 'textarea',
          required: true,
          canBeOther: false,
          order: 1,
        },
      ],
      isActive: true,
      isPublic: true,
      settings: {
        allowMultipleResponses: true,
        requireLogin: false,
        showProgressBar: true,
      },
      analytics: {
        lastUpdated: new Date(),
        totalResponsesAnalyzed: 1,
        cacheVersion: 1,
        representativeQuotes: ['secret quote from respondent'],
        quotes: {
          representative: [{ text: 'secret quote from respondent' }],
        },
      },
    });
    formId = String(form._id);

    const submitted = await responseModel.create({
      formId: form._id,
      respondentEmail,
      answers: [{ questionId: 'q1', value: 'A private respondent answer' }],
      submittedAt: new Date(),
      ipAddress: '203.0.113.10',
      userAgent: 'e2e-idor-agent',
      metadata: {
        hasTextContent: true,
        processedForAnalytics: false,
        extractedKeywords: [],
      },
    });
    responseId = String(submitted._id);

    const extra = await formModel.create({
      title: 'Delete-target form',
      createdBy: owner._id,
      questions: [],
      isActive: false,
      isPublic: false,
      settings: {
        allowMultipleResponses: true,
        requireLogin: false,
        showProgressBar: true,
      },
    });
    deleteFormId = String(extra._id);

    formScopedRoutes = collectFormScopedRoutes(app);
    migrationRoutes = collectMigrationRoutes(app);
    expect(formScopedRoutes.length).toBeGreaterThan(0);
    expect(migrationRoutes.length).toBeGreaterThan(0);
  }, 90000);

  afterAll(async () => {
    if (formId) {
      await responseModel.deleteMany({ formId: new Types.ObjectId(formId) }).exec();
      await formModel.deleteOne({ _id: new Types.ObjectId(formId) }).exec();
    }
    if (deleteFormId) {
      await formModel.deleteOne({ _id: new Types.ObjectId(deleteFormId) }).exec();
    }
    if (userModel) {
      await userModel.deleteMany({ email: { $in: [ownerEmail, attackerEmail] } }).exec();
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  const ids = () => ({
    id: formId,
    formId,
    responseId,
    taskId: '00000000-0000-4000-8000-000000000001',
  });

  it('enumerates every form-scoped management route from the live router', () => {
    const listed = formScopedRoutes.map((route) => `${route.method} ${route.path}`);
    expect(listed).toEqual(
      expect.arrayContaining([
        'GET /forms/{id}',
        'GET /forms/{id}/responses',
        'GET /forms/{id}/analytics',
        'GET /forms/{id}/analytics/stream',
        'POST /forms/{id}/send-invitations',
      ]),
    );
  });

  it('denies the logged-in non-owner on every form-scoped route', async () => {
    const results: Array<{ route: string; status: number }> = [];

    for (const route of formScopedRoutes) {
      const res = await hit(route, tokenB, ids());
      results.push({ route: `${route.method} ${route.path}`, status: res.status });
      expect([403, 404]).toContain(res.status);
      const bodyText = JSON.stringify(res.body ?? {});
      expect(bodyText).not.toContain(ownerEmailLeak);
      expect(bodyText).not.toContain(respondentEmail);
      expect(bodyText).not.toContain('secret quote from respondent');
    }

    expect(results).toHaveLength(formScopedRoutes.length);
  });

  it('lets the owner read management surfaces (200) including PII they own', async () => {
    const formRes = await request(app.getHttpServer())
      .get(`/api/forms/${formId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(formRes.body._id === formId || formRes.body.id === formId).toBeTruthy();
    const serialized = JSON.stringify(formRes.body);
    expect(serialized).toContain(ownerEmailLeak);

    await request(app.getHttpServer())
      .get(`/api/forms/${formId}/responses`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
      .expect((res) => {
        const text = JSON.stringify(res.body);
        expect(text).toContain(respondentEmail);
      });

    await request(app.getHttpServer())
      .get(`/api/forms/${formId}/analytics`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
  });

  it('lets the owner call every non-destructive form-scoped route', async () => {
    const safeRoutes = formScopedRoutes.filter(
      (route) => !isDeleteRoute(route) && !isStreamingRoute(route),
    );

    for (const route of safeRoutes) {
      const res = await hit(route, tokenA, ids());
      const allowed = route.method === 'POST' ? [200, 201] : [200];
      expect(allowed).toContain(res.status);
    }

    await request(app.getHttpServer())
      .patch(`/api/forms/${formId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isPublic: true, isActive: true })
      .expect(200);

    // Stream is the same owner check as GET /analytics; do not open SSE here
    // or e2e will enqueue a real orchestration job.

    const deleteRoute = formScopedRoutes.find(isDeleteRoute);
    if (deleteRoute) {
      const denied = await hit(deleteRoute, tokenB, { ...ids(), id: deleteFormId });
      expect([403, 404]).toContain(denied.status);

      const allowed = await hit(deleteRoute, tokenA, { ...ids(), id: deleteFormId });
      expect([200, 204]).toContain(allowed.status);
    }
  }, 15000);

  it('still serves the public respondent lookup to the non-owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/public/forms/${formId}`)
      .expect(200);
    expect(res.body.title).toBeDefined();
  });

  it('returns 403 on every /migrations/* route for a non-admin', async () => {
    for (const route of migrationRoutes) {
      const path = instantiatePath(route.path, {});
      const req = request(app.getHttpServer())
        [route.method.toLowerCase() as 'get' | 'post'](path)
        .set('Authorization', `Bearer ${tokenB}`);
      if (route.method !== 'GET') {
        req.send({});
      }
      const res = await req;
      expect(res.status).toBe(403);
    }
  });
});
