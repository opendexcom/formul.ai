import { Types } from 'mongoose';
import {
  extractFormIdFromRequest,
  getFormOwnerId,
  isValidFormId,
} from './form-access.util';

describe('form-access.util', () => {
  describe('getFormOwnerId', () => {
    it('reads a raw ObjectId', () => {
      const ownerId = new Types.ObjectId();
      expect(getFormOwnerId(ownerId)).toBe(String(ownerId));
    });

    it('reads a populated createdBy document', () => {
      const ownerId = new Types.ObjectId();
      expect(
        getFormOwnerId({
          _id: ownerId,
          email: 'owner@example.com',
          firstName: 'Ada',
        }),
      ).toBe(String(ownerId));
    });
  });

  describe('extractFormIdFromRequest', () => {
    it('prefers params.id, then params.formId, then query.formId', () => {
      const formId = new Types.ObjectId().toString();
      expect(extractFormIdFromRequest({ params: { id: formId } })).toBe(formId);
      expect(extractFormIdFromRequest({ params: { formId } })).toBe(formId);
      expect(extractFormIdFromRequest({ query: { formId } })).toBe(formId);
      expect(extractFormIdFromRequest({ params: {}, query: {} })).toBeUndefined();
    });
  });

  describe('isValidFormId', () => {
    it('accepts ObjectIds and rejects static path segments', () => {
      expect(isValidFormId(new Types.ObjectId().toString())).toBe(true);
      expect(isValidFormId('debug')).toBe(false);
      expect(isValidFormId('analytics')).toBe(false);
      expect(isValidFormId('notanobjectid')).toBe(false);
    });
  });
});
