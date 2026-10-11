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

    await createVerifiedUser(ownerEmail);
    await createVerifiedUser(attackerEmail);
    tokenA = await login(ownerEmail);
    tokenB = await login(attackerEmail);

    const created = await request(app.getHttpServer())
      .post('/api/forms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Public IDOR survey',
        description: 'Owner analytics must stay private',
        questions: [
          {
            id: 'q1',
            title: 'How was it?',
            type: 'textarea',
            required: true,
            order: 1,
          },
        ],
      })
      .expect(201);

    formId = created.body._id;
    expect(formId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/forms/${formId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isPublic: true, isActive: true })
      .expect(200);

    const submitted = await request(app.getHttpServer())
      .post(`/api/public/forms/${formId}/responses`)
      .send({
        responses: { q1: 'A private respondent answer' },
        respondentEmail,
      })
      .expect(201);

    responseId = submitted.body.responseId;
    expect(responseId).toBeDefined();

    await formModel.updateOne(
      { _id: new Types.ObjectId(formId) },
      {
        $set: {
          analytics: {
            lastUpdated: new Date(),
            totalResponsesAnalyzed: 1,
            cacheVersion: 1,
            representativeQuotes: ['secret quote from respondent'],
            quotes: {
              representative: [{ text: 'secret quote from respondent' }],
            },
          },
        },
      },
    );

    const extra = await request(app.getHttpServer())
      .post('/api/forms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Delete-target form' })
      .expect(201);
    deleteFormId = extra.body._id;

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
  });

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
      expect(res.status).toBe(200);
    }

    await request(app.getHttpServer())
      .patch(`/api/forms/${formId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isPublic: true, isActive: true })
      .expect(200);

    const stream = formScopedRoutes.find(isStreamingRoute);
    if (stream) {
      await new Promise<void>((resolve, reject) => {
        const req = hit(stream, tokenA, ids());
        req.on('response', (res: { statusCode?: number; status?: number }) => {
          try {
            const status = res.statusCode ?? res.status ?? 0;
            expect(status).toBe(200);
            req.abort();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        req.end((error: Error) => {
          if (error && (error as { code?: string }).code !== 'ECONNRESET') {
            reject(error);
          }
        });
      });
    }

    const deleteRoute = formScopedRoutes.find(isDeleteRoute);
    if (deleteRoute) {
      const denied = await hit(deleteRoute, tokenB, { ...ids(), id: deleteFormId });
      expect([403, 404]).toContain(denied.status);

      const allowed = await hit(deleteRoute, tokenA, { ...ids(), id: deleteFormId });
      expect([200, 204]).toContain(allowed.status);
    }
  });

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
