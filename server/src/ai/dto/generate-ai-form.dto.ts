import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DocumentAttachmentDto {
  @ApiProperty({ description: 'Base64-encoded file content' })
  @IsString()
  base64: string;

  @ApiProperty({ description: 'MIME type, e.g. application/pdf' })
  @IsString()
  mimetype: string;

  @ApiPropertyOptional({ description: 'Original filename' })
  @IsOptional()
  @IsString()
  filename?: string;
}

export class GenerateAIFormDto {
  @ApiProperty({ description: 'User prompt describing the form to build or refinement instructions' })
  @IsString()
  prompt: string;

  @ApiProperty({ enum: ['generate', 'refine'], default: 'generate' })
  @IsIn(['generate', 'refine'])
  mode: 'generate' | 'refine' = 'generate';

  @ApiPropertyOptional({ description: 'Current form when refining' })
  @IsOptional()
  @IsObject()
  currentForm?: any;

  @ApiPropertyOptional({ description: 'Attached PDF document to create form from' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentAttachmentDto)
  document?: DocumentAttachmentDto;
}
