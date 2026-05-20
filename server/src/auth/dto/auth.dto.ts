import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../validators/strong-password.validator';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecureP@ss1',
    minLength: 8,
    description:
      'At least 8 characters with uppercase, lowercase, number, and special character',
  })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  /** Plugin-specific fields (e.g. EE terms acceptance); validated by registration extensions */
  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-uuid' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'SecureP@ss1',
    minLength: 8,
    description:
      'At least 8 characters with uppercase, lowercase, number, and special character',
  })
  @IsString()
  @IsStrongPassword()
  password: string;
}