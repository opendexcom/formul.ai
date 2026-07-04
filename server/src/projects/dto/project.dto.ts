import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Research on onboarding friction' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Users abandon during signup due to too many required fields.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hypothesis?: string;

  @ApiPropertyOptional({ enum: ['single', 'ab_test'], default: 'single' })
  @IsOptional()
  @IsIn(['single', 'ab_test'])
  type?: 'single' | 'ab_test';
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Updated research name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hypothesis?: string;

  @ApiPropertyOptional({ type: [String], example: ['Shorter onboarding reduces drop-off'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  hypotheses?: string[];

  @ApiPropertyOptional({
    example: 'Document study goals, methodology, and baseline assumptions for analysts.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  researchNotes?: string;
}

export class UpdateProjectVariantDto {
  @ApiPropertyOptional({
    example: 'Test whether fewer required fields increase completion without hurting data quality.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalDescription?: string;

  @ApiPropertyOptional({ example: 'Shorter onboarding copy' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetGroupName?: string;
}

export class AddProjectVariantDto {
  @ApiPropertyOptional({ enum: ['A', 'B'], description: 'Defaults to the next available variant key' })
  @IsOptional()
  @IsIn(['A', 'B'])
  key?: 'A' | 'B';

  @ApiPropertyOptional({ example: 'Shorter onboarding copy' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetGroupName?: string;

  @ApiPropertyOptional({ enum: ['main', 'A', 'B'], default: 'main' })
  @IsOptional()
  @IsIn(['main', 'A', 'B'])
  cloneFromKey?: 'main' | 'A' | 'B';

  @ApiPropertyOptional({
    type: [String],
    description: 'Question IDs to omit from the cloned variant form',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeQuestionIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Question IDs intentionally edited in this variant',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiedQuestionIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Subset of modifiedQuestionIds with reverse-coded polarity',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  polarityFlippedQuestionIds?: string[];
}
