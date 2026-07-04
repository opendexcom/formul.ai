import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get integration connection status for current user' })
  getStatus(@Request() req) {
    const userId = req.user._id || req.user.id;
    return this.integrationsService.getStatus(userId);
  }

  @Post(':provider/connect')
  @ApiOperation({ summary: 'Create or regenerate an inbound integration hook' })
  connect(
    @Param('provider') provider: string,
    @Body() dto: ConnectIntegrationDto,
    @Request() req,
  ) {
    const userId = req.user._id || req.user.id;
    return this.integrationsService.connect(userId, provider, {
      discordPublicKey: dto.discordPublicKey,
    });
  }

  @Delete(':provider')
  @ApiOperation({ summary: 'Disconnect an integration provider' })
  disconnect(@Param('provider') provider: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.integrationsService.disconnect(userId, provider);
  }
}
