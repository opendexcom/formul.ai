import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

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
}
