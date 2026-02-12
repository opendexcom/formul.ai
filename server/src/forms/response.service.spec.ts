import { Types } from 'mongoose';
import { ResponseService } from './response.service';

describe('ResponseService', () => {
  let service: ResponseService;
  let mockResponseModel: any;

  beforeEach(() => {
    const savedDocs: any[] = [];
    mockResponseModel = jest.fn(function (this: any, data: any) {
      this._id = new Types.ObjectId();
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
    });
    mockResponseModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });
    mockResponseModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockResponseModel.countDocuments = jest.fn().mockResolvedValue(0);
    mockResponseModel.findByIdAndDelete = jest.fn().mockResolvedValue(undefined);

    service = new ResponseService(mockResponseModel);
  });

  describe('createResponse', () => {
    it('maps responses to answers and sets hasTextContent when text present', async () => {
      const instance = { save: jest.fn().mockResolvedValue({ _id: 'r1', submittedAt: new Date() }) };
      (mockResponseModel as jest.Mock).mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = instance.save;
        return this;
      });

      const result = await service.createResponse({
        formId: new Types.ObjectId().toString(),
        responses: { q1: 'Hello world', q2: 'Yes' },
        respondentEmail: 'a@b.com',
      });

      expect(mockResponseModel).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: expect.any(Types.ObjectId),
          answers: [
            { questionId: 'q1', value: 'Hello world' },
            { questionId: 'q2', value: 'Yes' },
          ],
          metadata: expect.objectContaining({
            hasTextContent: true,
            processedForAnalytics: false,
          }),
        }),
      );
      expect(instance.save).toHaveBeenCalled();
    });

    it('sets hasTextContent false when no text answers', async () => {
      const instance = { save: jest.fn().mockResolvedValue({}) };
      (mockResponseModel as jest.Mock).mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = instance.save;
        return this;
      });

      await service.createResponse({
        formId: new Types.ObjectId().toString(),
        responses: { q1: '', q2: 5 },
      });

      expect(mockResponseModel).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ hasTextContent: false }),
        }),
      );
    });
  });

  describe('getResponsesByFormId', () => {
    it('builds query with formId and merges additional filters', async () => {
      const formId = new Types.ObjectId().toString();
      const responses = [{ _id: 'r1', answers: [] }];
      const exec = jest.fn().mockResolvedValue(responses);
      (mockResponseModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({ exec }),
      });

      const result = await service.getResponsesByFormId(formId, { status: 'submitted' });

      expect(mockResponseModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: expect.any(Types.ObjectId),
          status: 'submitted',
        }),
      );
      expect(result).toEqual(responses);
    });
  });

  describe('getFormAnalytics', () => {
    it('returns empty analytics when no responses', async () => {
      (mockResponseModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getFormAnalytics(new Types.ObjectId().toString());

      expect(result).toEqual({
        totalResponses: 0,
        analytics: {},
        lastResponse: null,
      });
    });

    it('groups answers by questionId and aggregates valueCount', async () => {
      const formId = new Types.ObjectId().toString();
      const responses = [
        {
          answers: [
            { questionId: 'q1', value: 'A' },
            { questionId: 'q2', value: 'X' },
          ],
          submittedAt: new Date('2025-01-01'),
        },
        {
          answers: [
            { questionId: 'q1', value: 'B' },
            { questionId: 'q2', value: 'X' },
          ],
          submittedAt: new Date('2025-01-02'),
        },
      ];
      (mockResponseModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(responses),
        }),
      });

      const result = await service.getFormAnalytics(formId);

      expect(result.totalResponses).toBe(2);
      expect(result.analytics.q1.responses).toEqual(['A', 'B']);
      expect(result.analytics.q1.valueCount).toEqual({ A: 1, B: 1 });
      expect(result.analytics.q2.valueCount).toEqual({ X: 2 });
      expect(result.lastResponse).toEqual(new Date('2025-01-01'));
    });
  });

  describe('getResponseCount', () => {
    it('returns count from countDocuments', async () => {
      (mockResponseModel.countDocuments as jest.Mock).mockResolvedValue(42);

      const result = await service.getResponseCount(new Types.ObjectId().toString());

      expect(result).toBe(42);
    });
  });
});
