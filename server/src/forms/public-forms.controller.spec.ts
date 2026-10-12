process.env.JWT_SECRET ??= 'formulai-test-jwt-secret';

import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import { PublicFormsController } from './forms.controller';
import { FormsService } from './forms.service';

describe('PublicFormsController (ObjectId pipe)', () => {
  let app: INestApplication;
  let findPublicForm: jest.Mock;

  beforeAll(async () => {
    findPublicForm = jest.fn();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PublicFormsController],
      providers: [
        {
          provide: FormsService,
          useValue: {
            findPublicForm,
            submitResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    findPublicForm.mockReset();
  });

  it('GET /api/public/forms/notanobjectid returns 400', async () => {
    await request(app.getHttpServer())
      .get('/api/public/forms/notanobjectid')
      .expect(400);

    expect(findPublicForm).not.toHaveBeenCalled();
  });

  it('GET /api/public/forms/:id returns 404 for a nonexistent valid ObjectId', async () => {
    const missingId = new Types.ObjectId().toString();
    findPublicForm.mockRejectedValue(new NotFoundException('Form not found'));

    await request(app.getHttpServer())
      .get(`/api/public/forms/${missingId}`)
      .expect(404);

    expect(findPublicForm).toHaveBeenCalledWith(missingId);
  });
});
