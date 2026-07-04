import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuestionDto {
  @ApiProperty({ example: 'q1' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'What is your name?' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Please enter your full name' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'text',
    enum: [
      'text',
      'textarea',
      'multiple_choice',
      'checkbox',
      'dropdown',
      'email',
      'number',
      'date',
      'time',
      'rating',
      'comment',
    ],
  })
  @IsString()
  type: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Can this question be other (if yes, then last option should be "Other" and it should be the last option, we will show text input for other)',
  })
  @IsBoolean()
  canBeOther?: boolean;

  @ApiPropertyOptional({
    example: 'Please specify',
    description: 'Placeholder text for the "other" option input field',
  })
  @IsOptional()
  @IsString()
  otherPlaceholder?: string;

  @ApiPropertyOptional({ example: ['Option 1', 'Option 2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({ example: 1 })
  order: number;

  @ApiPropertyOptional()
  @IsOptional()
  validation?: Record<string, any>;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, higher values mean the opposite of the construct; analytics invert scores before comparison.',
  })
  @IsOptional()
  @IsBoolean()
  reverseCoded?: boolean;

  @ApiPropertyOptional({
    example: 'q3',
    description:
      'When reverse-coded on a variant branch, the question ID on the source variant (usually main) that this item pairs with.',
  })
  @IsOptional()
  @IsString()
  pairedQuestionId?: string;
}

export class CreateFormDto {
  @ApiProperty({ example: 'Customer Feedback Survey' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Collect feedback from our customers' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [CreateQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  settings?: {
    allowMultipleResponses: boolean;
    requireLogin: boolean;
    showProgressBar: boolean;
    customTheme?: {
      primaryColor?: string;
      backgroundColor?: string;
      fontFamily?: string;
    };
  };

  @ApiPropertyOptional({ description: 'Owning project ID' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: ['main', 'A', 'B'], default: 'main' })
  @IsOptional()
  @IsString()
  variantKey?: 'main' | 'A' | 'B';
}

export class UpdateFormDto {
  // Note: createdBy is intentionally excluded - it should never be updatable

  @ApiPropertyOptional({ example: 'Updated Survey Title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [CreateQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  settings?: {
    allowMultipleResponses: boolean;
    requireLogin: boolean;
    showProgressBar: boolean;
    customTheme?: {
      primaryColor?: string;
      backgroundColor?: string;
      fontFamily?: string;
    };
  };
}
