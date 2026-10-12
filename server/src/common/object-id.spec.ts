import { Types } from 'mongoose';
import { isValidObjectId } from './object-id';

describe('isValidObjectId', () => {
  it('accepts a 24-character hex ObjectId', () => {
    expect(isValidObjectId(new Types.ObjectId().toString())).toBe(true);
    expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
  });

  it('accepts uppercase hex ObjectIds', () => {
    expect(isValidObjectId('507F1F77BCF86CD799439011')).toBe(true);
  });

  it('rejects non-hex, wrong-length, and non-string values', () => {
    expect(isValidObjectId('notanobjectid')).toBe(false);
    expect(isValidObjectId('debug')).toBe(false);
    expect(isValidObjectId('12charstring')).toBe(false);
    expect(isValidObjectId('zzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
    expect(isValidObjectId('')).toBe(false);
    expect(isValidObjectId(undefined)).toBe(false);
    expect(isValidObjectId(null)).toBe(false);
    expect(isValidObjectId(123)).toBe(false);
  });
});
