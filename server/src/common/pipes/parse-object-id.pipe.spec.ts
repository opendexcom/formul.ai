import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from './parse-object-id.pipe';

describe('ParseObjectIdPipe', () => {
  const pipe = new ParseObjectIdPipe();

  it('returns a valid ObjectId unchanged', () => {
    const id = new Types.ObjectId().toString();
    expect(pipe.transform(id)).toBe(id);
  });

  it('throws BadRequestException for a non-ObjectId string', () => {
    expect(() => pipe.transform('notanobjectid')).toThrow(BadRequestException);
    expect(() => pipe.transform('notanobjectid')).toThrow(
      'Validation failed (ObjectId is expected)',
    );
  });

  it('throws BadRequestException for 12-character strings mongoose would accept', () => {
    expect(() => pipe.transform('12charstring')).toThrow(BadRequestException);
  });
});
