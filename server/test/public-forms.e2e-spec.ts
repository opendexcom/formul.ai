import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { Types, type Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { Form, FormDocument } from '../src/schemas/form.schema';
import { Response, ResponseDocument } from '../src/schemas/response.schema';
import {
  PUBLIC_FORM_ALLOWED_KEYS,
  PUBLIC_FORM_REQUIRED_KEYS,
  PUBLIC_QUESTION_ALLOWED_KEYS,
  PUBLIC_SETTINGS_ALLOWED_KEYS,
} from '../src/forms/dto/public-form.dto';

/**
 * Fields the old full-document GET leaked. This suite seeds them on a
 * public + active form so the request would fail against the pre-whitelist
 * serializer and must pass against the allowlist.
 */
const FORBIDDEN_PUBLIC_FORM_KEYS = [
  'analytics',
  'analyticsLock',
  'analyticsLockStartedAt',
  'isActive',
  'isPublic',
  'createdBy',
  'projectId',
  'owner',
  'invitations',
  'collaborators',
  'statistics',
  'variantKey',
  '__v',
] as const;

describe('Public forms (e2e) – no analytics / owner / invitations leak', () => {
  let app: INestApplication<App>;
  let formModel: Model<FormDocument>;
  let responseModel: Model<ResponseDocument>;
  let seededFormId: string;

  const leakedQuote = 'Another respondent said: the cafeteria coffee is terrible';
  const ownerEmail = 'form-owner@example.com';
  const inviteeEmail = 'invitee@example.com';
  const lockStartedAt = new Date('2026-01-15T12:00:00.000Z');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    formModel = moduleFixture.get(getModelToken(Form.name));
    responseModel = moduleFixture.get(getModelToken(Response.name));

    const ownerId = new Types.ObjectId();
    const formId = new Types.ObjectId();
    await formModel.collection.insertOne({
      _id: formId,
      title: 'Public GDPR form',
      description: 'Respondent-facing survey',
      createdBy: ownerId,
      owner: { id: String(ownerId), email: ownerEmail },
      invitations: [{ email: inviteeEmail, token: 'invite-secret' }],
      collaborators: [{ email: 'collab@example.com' }],
      isPublic: true,
      isActive: true,
      projectId: new Types.ObjectId(),
      variantKey: 'main',
      analyticsLock: 'lock-task',
      analyticsLockStartedAt: lockStartedAt,
      questions: [
        {
          id: 'q1',
          title: 'What did you think?',
          description: 'Share your view',
          type: 'textarea',
          required: true,
          canBeOther: false,
          options: [],
          order: 1,
          validation: { minLength: { value: 2 } },
          reverseCoded: false,
        },
      ],
      settings: {
        allowMultipleResponses: true,
        requireLogin: false,
        showProgressBar: true,
        customTheme: {
          primaryColor: '#2563EB',
          backgroundColor: '#F9FAFB',
          fontFamily: 'Inter',
        },
      },
      analytics: {
        lastUpdated: new Date(),
        totalResponsesAnalyzed: 12,
        representativeQuotes: [leakedQuote],
        quotes: {
          representative: [
            {
              text: leakedQuote,
              responseId: 'resp-hidden',
              submittedAt: new Date(),
              topics: ['coffee'],
              sentiment: 'negative',
            },
          ],
        },
      },
      statistics: { totalResponses: 12 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    seededFormId = String(formId);
  }, 60000);

  afterAll(async () => {
    if (seededFormId) {
      const formObjectId = new Types.ObjectId(seededFormId);
      if (responseModel) {
        await responseModel.deleteMany({ formId: formObjectId }).exec();
      }
      if (formModel) {
        await formModel.collection.deleteOne({ _id: formObjectId });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('seeds a public+active form whose stored document still has the leak payload', async () => {
    const stored = (await formModel.collection.findOne({
      _id: new Types.ObjectId(seededFormId),
    })) as {
      isPublic?: boolean;
      isActive?: boolean;
      createdBy?: unknown;
      projectId?: unknown;
      analyticsLock?: string;
      analyticsLockStartedAt?: Date;
      analytics?: {
        representativeQuotes?: string[];
        quotes?: { representative?: Array<{ text?: string }> };
      };
    } | null;

    expect(stored).toBeTruthy();
    expect(stored?.isPublic).toBe(true);
    expect(stored?.isActive).toBe(true);
    expect(stored?.createdBy).toBeDefined();
    expect(stored?.projectId).toBeDefined();
    expect(stored?.analyticsLock).toBe('lock-task');
    expect(stored?.analyticsLockStartedAt).toEqual(lockStartedAt);
    expect(stored?.analytics?.representativeQuotes).toEqual([leakedQuote]);
    expect(stored?.analytics?.quotes?.representative?.[0]?.text).toBe(leakedQuote);
  });

  it('GET /api/public/forms/:id omits analytics quotes and other leaked fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/public/forms/${seededFormId}`)
      .expect(200);

    // Old findById().exec() returned the raw document; these would then be present.
    expect(res.body.analytics?.representativeQuotes).toBeUndefined();
    expect(res.body.analytics).toBeUndefined();
    for (const key of FORBIDDEN_PUBLIC_FORM_KEYS) {
      expect(res.body).not.toHaveProperty(key);
    }

    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(leakedQuote);
    expect(bodyText).not.toContain(ownerEmail);
    expect(bodyText).not.toContain(inviteeEmail);
    expect(bodyText).not.toContain('invite-secret');
    expect(bodyText).not.toContain('lock-task');
  });

  it('GET /api/public/forms/:id returns only the allowlisted key set', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/public/forms/${seededFormId}`)
      .expect(200);

    const keys = Object.keys(res.body).sort();
    expect(PUBLIC_FORM_ALLOWED_KEYS).toEqual(
      expect.arrayContaining(PUBLIC_FORM_REQUIRED_KEYS),
    );
    expect(keys).toEqual([...PUBLIC_FORM_REQUIRED_KEYS].sort());
    expect(keys.every((key) => PUBLIC_FORM_ALLOWED_KEYS.includes(key as any))).toBe(true);
    for (const key of [
      'analyticsLock',
      'analyticsLockStartedAt',
      'isActive',
      'isPublic',
      'createdBy',
      'projectId',
    ]) {
      expect(keys).not.toContain(key);
    }

    expect(res.body).toMatchObject({
      id: seededFormId,
      title: 'Public GDPR form',
      description: 'Respondent-facing survey',
    });
    expect(res.body.questions).toHaveLength(1);
    expect(Object.keys(res.body.questions[0]).every((key) =>
      PUBLIC_QUESTION_ALLOWED_KEYS.includes(key as any),
    )).toBe(true);
    expect(Object.keys(res.body.settings).every((key) =>
      PUBLIC_SETTINGS_ALLOWED_KEYS.includes(key as any),
    )).toBe(true);
    expect(res.body.questions[0]).not.toHaveProperty('reverseCoded');
  });

  it('POST /api/public/forms/:id/responses does not return the form document', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/public/forms/${seededFormId}/responses`)
      .send({ responses: { q1: 'Great event' } })
      .expect(201);

    expect(Object.keys(res.body).sort()).toEqual(
      ['formId', 'message', 'responseId', 'submittedAt', 'success'].sort(),
    );
    expect(res.body.success).toBe(true);
    expect(res.body).not.toHaveProperty('analytics');
    expect(res.body).not.toHaveProperty('questions');
    expect(JSON.stringify(res.body)).not.toContain(leakedQuote);
  });
});
