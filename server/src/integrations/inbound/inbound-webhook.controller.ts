import {
  Controller,
  Param,
  Post,
  Req,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { InboundRouterService } from './inbound-router.service';

@ApiTags('Integrations')
@Controller('integrations/hooks')
export class InboundWebhookController {
  private readonly logger = new Logger(InboundWebhookController.name);

  constructor(private readonly inboundRouter: InboundRouterService) {}

  @Post(':hookId')
  @ApiOperation({ summary: 'Receive inbound integration webhook payloads' })
  async handleWebhook(
    @Param('hookId') hookId: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody;
    try {
      const result = await this.inboundRouter.handleInbound(hookId, req, rawBody);
      return result.body;
    } catch (error) {
      this.logger.warn(
        `Inbound webhook rejected for hook ${hookId}: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }
}
