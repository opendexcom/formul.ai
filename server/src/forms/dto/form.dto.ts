import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
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

  @ApiProperty({ example: 'text', enum: ['text', 'textarea', 'multiple_choice', 'checkbox', 'dropdown', 'email', 'number', 'date', 'time', 'rating'] })
  @IsString()
  type: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  required: boolean;

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