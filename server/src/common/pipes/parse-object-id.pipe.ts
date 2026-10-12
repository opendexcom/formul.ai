import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from '../object-id';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException('Validation failed (ObjectId is expected)');
    }
    return value;
  }
}
