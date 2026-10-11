import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User, UserDocument } from '../src/schemas/user.schema';
import type { Model } from 'mongoose';

/**
 * P0 E2E: Auth – login and access.
 * Flow: register (or create verified user) → login → GET /api/forms with JWT.
 */
describe('Auth (e2e) – login and protected route access', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;

  const testUser = {
    email: `e2e-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'E2E',
    lastName: 'User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    userModel = moduleFixture.get(getModelToken(User.name));
  }, 60000);

  afterAll(async () => {
    if (userModel) {
      await userModel.deleteOne({ email: testUser.email }).exec();
    }
    if (app) {
      await app.close();
    }
  });

  it('POST /api/auth/register then login and GET /api/forms returns 200', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testUser.email,
        password: testUser.password,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      })
      .expect(201);

    await userModel
      .updateOne(
        { email: testUser.email },
        { $set: { isEmailVerified: true } },
      )
      .exec();

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const token = (loginRes.body as { token?: string }).token;
    expect(token).toBeDefined();

    const formsRes = await request(app.getHttpServer())
      .get('/api/forms')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(formsRes.body)).toBe(true);
  });
});
