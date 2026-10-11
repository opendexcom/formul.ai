import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../../auth/validators/strong-password.validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentP@ss1' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    example: 'NewSecureP@ss1',
    minLength: 8,
    description:
      'At least 8 characters with uppercase, lowercase, number, and special character',
  })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
