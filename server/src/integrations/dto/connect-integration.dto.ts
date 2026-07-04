import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectIntegrationDto {
  @ApiPropertyOptional({
    description: 'Discord Application Public Key for Ed25519 signature verification',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  discordPublicKey?: string;
}
