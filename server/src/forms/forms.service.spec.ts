import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FormsService } from './forms.service';
import { ResponseService } from './response.service';
import { serializeLogArgs } from './response-submission-log';

describe('FormsService', () => {
  let service: FormsService;
  let mockFormModel: any;
  let mockProjectModel: any;
  let mockResponseService: jest.Mocked<ResponseService>;

  beforeEach(() => {
    mockFormModel = jest.fn(function (this: any, data: any) {
      this.data = data;
      this.save = jest.fn().mockResolvedValue(this);
    }) as any;

    mockFormModel.find = jest.fn();
    mockFormModel.findById = jest.fn();
    mockFormModel.findByIdAndDelete = jest.fn();

    mockProjectModel = {
      create: jest.fn().mockResolvedValue({}),
      findById: jest.fn(),
    };

    mockResponseService = {
      getFormAnalytics: jest.fn(),
      getResponseCount: jest.fn(),
      getResponsesByFormId: jest.fn(),
      createResponse: jest.fn(),
    } as any;

    service = new FormsService(mockFormModel, mockProjectModel, mockResponseService);
  });

  describe('create', () => {
    it('creates a form with default settings and user as creator', async () => {
      const userId = new Types.ObjectId().toString();
      const dto = {
        title: 'My form',
        description: 'Desc',
        // omit settings to use service defaults
      } as any;

      const result = await service.create(dto, userId);

      expect(mockFormModel).toHaveBeenCalledTimes(1);
      const instance = (mockFormModel as jest.Mock).mock.instances[0] as any;
      expect(instance.data.title).toBe('My form');
      expect(instance.data.createdBy).toBeInstanceOf(Types.ObjectId);
      expect(instance.data.settings.allowMultipleResponses).toBe(true);
      expect(result).toBe(instance);
    });

    it('allows attaching a form to a project the caller owns', async () => {
      const userId = new Types.ObjectId().toString();
      const projectId = new Types.ObjectId();
      mockProjectModel.findById.mockResolvedValueOnce({
        _id: projectId,
        ownerId: { toString: () => userId },
      });

      await service.create(
        { title: 'Owned project form', projectId: String(projectId) } as any,
        userId,
      );

      expect(mockProjectModel.findById).toHaveBeenCalledWith(String(projectId));
    });

    it('rejects create when projectId belongs to another user', async () => {
      const userId = new Types.ObjectId().toString();
      const projectId = new Types.ObjectId();
      mockProjectModel.findById.mockResolvedValueOnce({
        _id: projectId,
        ownerId: { toString: () => new Types.ObjectId().toString() },
      });

      await expect(
        service.create(
          { title: 'Stolen project', projectId: String(projectId) } as any,
          userId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockFormModel).not.toHaveBeenCalled();
    });
  });

  describe('findAllByUser', () => {
    it('returns forms for user sorted by createdAt desc', async () => {
      const userId = new Types.ObjectId().toString();
      const forms = [
        { _id: new Types.ObjectId(), title: 'Form A' },
        { _id: new Types.ObjectId(), title: 'Form B' },
      ];
      (mockFormModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(forms),
        }),
      });

      const result = await service.findAllByUser(userId);

      expect(mockFormModel.find).toHaveBeenCalledWith({
        createdBy: expect.any(Types.ObjectId),
      });
      expect(result).toEqual(forms);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when form does not exist', async () => {
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.findOne(new Types.ObjectId().toString(), 'user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows owner access', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: ownerId,
        isPublic: false,
      };
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(form),
        }),
      });

      const result = await service.findOne(String(form._id), String(ownerId));
      expect(result).toBe(form);
    });

    it('denies non-owner even when the form is public', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: ownerId,
        isPublic: true,
      };
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(form),
        }),
      });

      await expect(
        service.findOne(
          String(form._id),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies access when not owner and not public', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: ownerId,
        isPublic: false,
      };
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(form),
        }),
      });

      await expect(
        service.findOne(
          String(form._id),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertFormAccess', () => {
    it('returns the form for the owner', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: ownerId,
        isPublic: true,
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);

      await expect(
        service.assertFormAccess(String(ownerId), String(form._id)),
      ).resolves.toBe(form);
    });

    it('returns 404 for a non-owner even when the form is public', async () => {
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: new Types.ObjectId(),
        isPublic: true,
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);

      await expect(
        service.assertFormAccess(new Types.ObjectId().toString(), String(form._id)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 when the form does not exist', async () => {
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.assertFormAccess(new Types.ObjectId().toString(), new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findPublicForm', () => {
    it('throws NotFoundException when form missing', async () => {
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findPublicForm(new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when not public or inactive', async () => {
      const form: any = {
        _id: new Types.ObjectId(),
        title: 'Test',
        isPublic: false,
        isActive: true,
      };
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(form),
      });

      await expect(
        service.findPublicForm(String(form._id)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns form when public and active', async () => {
      const form: any = {
        _id: new Types.ObjectId(),
        title: 'Test',
        isPublic: true,
        isActive: true,
      };
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(form),
      });

      const result = await service.findPublicForm(String(form._id));
      expect(result).toBe(form);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when form does not exist', async () => {
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.update(new Types.ObjectId().toString(), { title: 'X' } as any, 'user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids update by non-owner', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: { toString: () => String(ownerId) },
        title: 'Old',
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);

      await expect(
        service.update(String(form._id), { title: 'New' } as any, new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates and saves form for owner', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: { toString: () => String(ownerId) },
        title: 'Old',
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);

      const result = await service.update(
        String(form._id),
        { title: 'New title' } as any,
        String(ownerId),
      );

      expect(form.title).toBe('New title');
      expect(form.updatedAt).toBeInstanceOf(Date);
      expect(form.save).toHaveBeenCalled();
      expect(result).toBe(form);
    });

    it('rejects update when projectId belongs to another user', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: { toString: () => String(ownerId) },
        title: 'Old',
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);
      mockProjectModel.findById.mockResolvedValueOnce({
        ownerId: { toString: () => new Types.ObjectId().toString() },
      });

      await expect(
        service.update(
          String(form._id),
          { projectId: new Types.ObjectId().toString() } as any,
          String(ownerId),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(form.save).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when form does not exist', async () => {
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.remove(new Types.ObjectId().toString(), 'user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids deletion by non-owner', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: { toString: () => String(ownerId) },
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);

      await expect(
        service.remove(String(form._id), new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes form for owner', async () => {
      const ownerId = new Types.ObjectId();
      const formId = new Types.ObjectId();
      const form: any = {
        _id: formId,
        createdBy: { toString: () => String(ownerId) },
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);

      await service.remove(String(formId), String(ownerId));

      expect(mockFormModel.findByIdAndDelete).toHaveBeenCalledWith(String(formId));
    });
  });

  describe('getFormStats', () => {
    it('returns form stats with analytics from ResponseService', async () => {
      const formId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      const form: any = {
        _id: formId,
        createdBy: userId,
        isActive: true,
        isPublic: false,
      };
      const analytics = {
        totalResponses: 10,
        lastResponse: new Date(),
        analytics: { completionRate: 0.9 },
      };
      (mockFormModel.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(form),
        }),
      });
      mockResponseService.getFormAnalytics.mockResolvedValueOnce(analytics as any);

      const result = await service.getFormStats(formId, userId);

      expect(result.formId).toBe(formId);
      expect(result.totalResponses).toBe(10);
      expect(result.lastResponse).toBe(analytics.lastResponse);
      expect(result.isActive).toBe(true);
      expect(result.isPublic).toBe(false);
      expect(result.analytics).toEqual(analytics.analytics);
    });
  });

  describe('toggleActiveStatus', () => {
    it('throws NotFoundException when form not found', async () => {
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.toggleActiveStatus(new Types.ObjectId().toString(), 'user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when user is not owner', async () => {
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: new Types.ObjectId(),
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);

      await expect(
        service.toggleActiveStatus(String(form._id), new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('toggles isActive and saves for owner', async () => {
      const ownerId = new Types.ObjectId();
      const form: any = {
        _id: new Types.ObjectId(),
        createdBy: ownerId,
        isActive: true,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
      };
      (mockFormModel.findById as jest.Mock).mockResolvedValueOnce(form);

      const result = await service.toggleActiveStatus(String(form._id), String(ownerId));

      expect(form.isActive).toBe(false);
      expect(form.updatedAt).toBeInstanceOf(Date);
      expect(form.save).toHaveBeenCalled();
      expect(result).toBe(form);
    });
  });

  describe('getResponseCount', () => {
    it('delegates to ResponseService.getResponseCount', async () => {
      const formId = new Types.ObjectId().toString();
      mockResponseService.getResponseCount.mockResolvedValueOnce(42);

      const result = await service.getResponseCount(formId);

      expect(mockResponseService.getResponseCount).toHaveBeenCalledWith(formId);
      expect(result).toBe(42);
    });
  });

  describe('getFormResponses', () => {
    it('delegates to ResponseService.getResponsesByFormId', async () => {
      const formId = new Types.ObjectId().toString();
      const filters = { limit: 10 };
      const responses = [{ _id: 'r1' }];
      mockResponseService.getResponsesByFormId.mockResolvedValueOnce(responses as any);

      const result = await service.getFormResponses(formId, filters);

      expect(mockResponseService.getResponsesByFormId).toHaveBeenCalledWith(formId, filters);
      expect(result).toEqual(responses);
    });
  });

  describe('submitResponse', () => {
    it('throws when no responses provided', async () => {
      const form: any = {
        _id: new Types.ObjectId(),
        isPublic: true,
        isActive: true,
      };
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(form),
      });

      await expect(
        service.submitResponse(String(form._id), { respondentEmail: 'a@b.com' }),
      ).rejects.toThrow('No responses provided');
    });

    it('delegates to ResponseService after validating public form', async () => {
      const form: any = {
        _id: new Types.ObjectId(),
        title: 'Test',
        isPublic: true,
        isActive: true,
      };
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(form),
      });

      const saved = { _id: 'resp1', submittedAt: new Date() } as any;
      mockResponseService.createResponse.mockResolvedValueOnce(saved);

      const result = await service.submitResponse(
        String(form._id),
        { responses: { q1: 'Answer' } },
        '127.0.0.1',
        'agent',
      );

      expect(mockResponseService.createResponse).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.formId).toBe(String(form._id));
      expect(result.responseId).toBe(saved._id);
    });

    it('does not log answer text or respondent personal data', async () => {
      const form: any = {
        _id: new Types.ObjectId(),
        title: 'Test',
        isPublic: true,
        isActive: true,
      };
      (mockFormModel.findById as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(form),
      });

      const saved = { _id: 'resp1', submittedAt: new Date() } as any;
      mockResponseService.createResponse.mockResolvedValueOnce(saved);

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const secretAnswer = 'SECRET_ANSWER_TEXT_DO_NOT_LOG';
      const secretEmail = 'secret.respondent@example.com';

      try {
        await service.submitResponse(
          String(form._id),
          {
            responses: { q1: secretAnswer },
            respondentEmail: secretEmail,
          },
          '203.0.113.10',
          'SecretUserAgent/1.0',
        );

        const logs = logSpy.mock.calls.map((args) => serializeLogArgs(args)).join('\n');
        expect(logs).not.toContain(secretAnswer);
        expect(logs).not.toContain(secretEmail);
        expect(logs).not.toContain('203.0.113.10');
        expect(logs).not.toContain('SecretUserAgent/1.0');
        expect(logs).toContain(String(form._id));
        expect(logs).toContain('resp1');
        expect(logs).toMatch(/"answerCount":1/);
      } finally {
        logSpy.mockRestore();
      }
    });
  });
});


