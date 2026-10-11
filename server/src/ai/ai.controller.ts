import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AiService } from './ai.service';
import { GenerateAIFormDto } from './dto/generate-ai-form.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type UsageTrackingRequest = Request & {
  trackUsage?: (usage: unknown) => void | Promise<void>;
};

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate or refine a form using AI (non-streaming)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Response: { form: { title, description, questions }, usage?: { model, promptTokens?, completionTokens?, totalTokens? } }',
  })
  async generate(@Body() dto: GenerateAIFormDto) {
    return this.aiService.generate(dto);
  }

  @Post('generate-stream')
  @ApiOperation({ summary: 'Generate form with streaming progress updates' })
  async generateStream(
    @Body() dto: GenerateAIFormDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.FRONTEND_URL || 'http://localhost:3000',
    );
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
      try {
        res.end();
      } catch {}
    });
    const usageTrackingReq = req as UsageTrackingRequest;
    const authUser = req as Request & { user?: { _id?: { toString(): string }; id?: string } };
    const userId =
      authUser.user?._id?.toString?.() ?? authUser.user?.id?.toString?.();

    try {
      for await (const step of this.aiService.generateWithSteps(dto, { userId })) {
        if (clientClosed) break;
        res.write(`data: ${JSON.stringify(step)}\n\n`);
        if (step.usage && typeof usageTrackingReq.trackUsage === 'function') {
          try {
            void Promise.resolve(usageTrackingReq.trackUsage(step.usage)).catch(
              (trackUsageError: unknown) => {
                console.error(
                  '[AI Generate Stream] trackUsage hook rejected:',
                  trackUsageError,
                );
              },
            );
          } catch (trackUsageError: unknown) {
            console.error(
              '[AI Generate Stream] trackUsage hook threw:',
              trackUsageError,
            );
          }
        }
      }
      if (!clientClosed) res.end();
    } catch (error: any) {
      try {
        const safeErrorMsg = 'An error occurred during form generation';
        console.error('[AI Generate Stream] Error:', error);
        res.write(
          `data: ${JSON.stringify({
            step: 'error',
            message: safeErrorMsg,
            status: 'error',
          })}\n\n`,
        );
      } finally {
        res.end();
      }
    }
  }
}
