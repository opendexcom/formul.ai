import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Req,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FormsService } from './forms.service';
import { EmailService, SendInvitationDto } from './email.service';
import { AnalyticsService } from './analytics.service';
import { CreateFormDto, UpdateFormDto } from './dto/form.dto';
import { randomUUID } from 'crypto';
import { OrchestrationProducer } from '../analytics/queues/orchestration.producer';
import { ProgressService } from '../analytics/queues/progress.service';
import { FormOwnerGuard } from './guards/form-owner.guard';

@ApiTags('Forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormsController {
  private readonly logger = new Logger(FormsController.name);

  constructor(
    private readonly formsService: FormsService,
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
    private readonly jwtService: JwtService,
    private readonly orchestrationProducer: OrchestrationProducer,
    private readonly progressService: ProgressService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a new form' })
  @ApiResponse({ status: 201, description: 'Form successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createFormDto: CreateFormDto, @Request() req) {
    const userId = req.user._id || req.user.id;
    this.logger.log(`CREATE FORM REQUEST - Method: POST, User: ${req.user.email}`);
    this.logger.debug(`Data: ${JSON.stringify(createFormDto)}`);
    return this.formsService.create(createFormDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all forms for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Forms retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Request() req) {
    const userId = req.user._id || req.user.id;
    this.logger.log(`GET ALL FORMS REQUEST - Method: GET, User: ${req.user.email}, UserId: ${userId}`);
    return this.formsService.findAllByUser(userId);
  }

  @Get(':id')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Get a specific form by ID' })
  @ApiResponse({ status: 200, description: 'Form retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    this.logger.log(`GET FORM REQUEST - Form ID: ${id}, User: ${req.user.email}, UserId: ${userId}`);
    return this.formsService.findOne(id, userId);
  }

  @Patch(':id')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Update a form' })
  @ApiResponse({ status: 200, description: 'Form updated successfully' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  update(@Param('id') id: string, @Body() updateFormDto: UpdateFormDto, @Request() req) {
    // Extract user ID - try both _id and id properties
    const userId = req.user._id || req.user.id;
    this.logger.log(`Update form request - User: ${JSON.stringify(req.user)}, UserId: ${userId}`);
    return this.formsService.update(id, updateFormDto, userId);
  }

  @Delete(':id')
  @UseGuards(FormOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a form' })
  @ApiResponse({ status: 204, description: 'Form deleted successfully' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  remove(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.formsService.remove(id, userId);
  }

  @Get('debug/counts')
  @ApiOperation({ summary: 'Debug: Get form counts' })
  async getDebugCounts(@Request() req) {
    const userId = req.user._id || req.user.id;
    return this.formsService.getDebugCounts(userId);
  }

  @Get(':id/stats')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Get form statistics' })
  @ApiResponse({ status: 200, description: 'Form statistics retrieved successfully' })
  getStats(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.formsService.getFormStats(id, userId);
  }

  @Get(':id/response-count')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Get response count for a form' })
  @ApiResponse({ status: 200, description: 'Response count retrieved successfully' })
  async getResponseCount(@Param('id') id: string, @Request() req) {
    return { count: await this.formsService.getResponseCount(id) };
  }

  @Get(':id/responses')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Get all responses for a form with optional filtering' })
  @ApiResponse({ status: 200, description: 'Responses retrieved successfully' })
  @ApiQuery({ name: 'sentiment', required: false, enum: ['positive', 'neutral', 'negative', 'ambivalent'] })
  @ApiQuery({ name: 'topics', required: false, description: 'Comma-separated list of topics to filter by' })
  @ApiQuery({ name: 'representativeness', required: false, enum: ['typical', 'deviant', 'mixed'] })
  @ApiQuery({ name: 'depth', required: false, enum: ['superficial', 'moderate', 'deep'] })
  async getFormResponses(
    @Param('id') id: string,
    @Request() req,
    @Query('sentiment') sentiment?: string,
    @Query('topics') topics?: string,
    @Query('representativeness') representativeness?: string,
    @Query('depth') depth?: string,
  ) {
    // Build query filters
    const filters: any = {};
    if (sentiment) {
      // Case-insensitive sentiment filter using MongoDB $regex syntax
      filters['metadata.overallSentiment.label'] = { $regex: `^${sentiment}$`, $options: 'i' };
      this.logger.debug(`[getFormResponses] Sentiment filter applied: ${JSON.stringify({ sentiment, filter: filters['metadata.overallSentiment.label'] })}`);
    }
    if (topics) {
      const topicArray = topics.split(',').map(t => t.trim());
      // Filter by canonicalTopics (clustered topics) for consistency with analytics
      filters['metadata.canonicalTopics'] = { $in: topicArray };
    }
    if (representativeness) {
      // Case-insensitive representativeness filter
      filters['metadata.quotes.representativeness'] = { $regex: `^${representativeness}$`, $options: 'i' };
    }
    if (depth) {
      // Case-insensitive depth filter
      filters['metadata.quotes.responseQuality.depth'] = { $regex: `^${depth}$`, $options: 'i' };
    }

    this.logger.debug(`[getFormResponses] Complete filters object: ${JSON.stringify(filters, null, 2)}`);
    return this.formsService.getFormResponses(id, filters);
  }

  @Get(':id/analytics')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Get cached analytics for a form (read-only)' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics(
    @Param('id') id: string,
    @Request() req,
  ) {
    // Always return cached analytics, never regenerate
    return this.analyticsService.getFormAnalytics(id);
  }

  @Get(':id/analytics/stream')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Generate or regenerate analytics with SSE progress streaming' })
  @ApiQuery({ name: 'taskId', required: false, description: 'Existing task ID to reconnect to' })
  @ApiQuery({ name: 'reprocess', required: false, type: Boolean, description: 'Whether to reprocess all responses before generating analytics' })
  @ApiQuery({ name: 'onlyFailed', required: false, type: Boolean, description: 'Only reprocess responses that failed (requires reprocess=true)' })
  async streamAnalyticsGeneration(
    @Param('id') id: string,
    @Req() reqExpress: ExpressRequest,
    @Res() res: ExpressResponse,
    @Query('taskId') existingTaskId?: string,
    @Query('reprocess') reprocess?: string,
    @Query('onlyFailed') onlyFailed?: string,
  ) {
    const reprocessBool = reprocess === 'true';
    const onlyFailedBool = onlyFailed === 'true';

    this.logger.log(`[SSE] Analytics stream requested for form: ${id}`, {
      existingTaskId,
      reprocess: reprocessBool,
      onlyFailed: onlyFailedBool
    });

    // User is already authenticated and authorized via Guards
    // We can get the user from the request object attached by Passport
    // Note: In Express, req.user is populated by Passport
    const req = reqExpress as any;
    const userId = req.user?._id || req.user?.id;

    this.logger.debug(`[SSE] User authenticated via Guard: ${userId}`);

    // Use provided taskId or generate a new one
    const taskId = existingTaskId || randomUUID();
    const existing = Boolean(existingTaskId);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message with taskId
    const connectMsg = JSON.stringify({
      type: 'connected',
      message: existing ? 'Reconnected to existing analytics task' : 'Started new analytics task',
      taskId,
      existing,
    });
    this.logger.debug(`[SSE] Sending: ${connectMsg}`);
    res.write(`data: ${connectMsg}\n\n`);

    try {
      // Subscribe to progress events from Redis via Bull-managed client
      let unsubscribed = false;
      const unsubscribe = await this.progressService.onProgress((update) => {
        if (update.taskId !== taskId) return;
        const msg = JSON.stringify(update);
        res.write(`data: ${msg}\n\n`);
        if (update.type === 'complete' || update.type === 'error') {
          // End stream and cleanup (only once)
          if (!unsubscribed) {
            unsubscribed = true;
            unsubscribe().finally(() => {
              res.end();
              this.logger.log('[SSE] Stream ended and cleaned up');
            });
          }
        }
      });

      // If reprocessing is requested, do that first
      if (!existing && reprocessBool) {
        this.logger.log('[SSE] Reprocessing responses before generation...');
        const reprocessMsg = JSON.stringify({
          type: 'progress',
          message: 'Reprocessing responses...',
          progress: 0,
          taskId
        });
        res.write(`data: ${reprocessMsg}\n\n`);
        const reprocessResult = await this.analyticsService.reprocessAllResponses(id, onlyFailedBool);
        const modified = (reprocessResult?.modifiedCount ?? reprocessResult?.totalReprocessed ?? 0) as number;
        const reprocessedMsg = JSON.stringify({
          type: 'reprocessed',
          message: `${modified} responses marked for reprocessing`,
          progress: 2,
          taskId,
          modifiedCount: modified
        });
        res.write(`data: ${reprocessedMsg}\n\n`);
      }

      // Enqueue orchestration job (don't await)
      this.logger.log(`[SSE] Enqueuing orchestration job with taskId: ${taskId}`);
      await this.orchestrationProducer.enqueueOrchestration(id, taskId, true);

      // Cleanup on client disconnect (only if not already unsubscribed)
      reqExpress.on('close', () => {
        if (!unsubscribed) {
          unsubscribed = true;
          this.logger.log('[SSE] Client disconnected, cleaning up...');
          unsubscribe().catch(err => {
            this.logger.error('[SSE] Error during disconnect cleanup:', err);
          });
        }
      });
    } catch (error) {
      const errorMsg = JSON.stringify({ type: 'error', message: error.message, taskId });
      this.logger.error(`[SSE] Error: ${errorMsg}`);
      res.write(`data: ${errorMsg}\n\n`);
      res.end();
    }
  }

  @Get(':id/analytics/task/:taskId')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Get analytics task status' })
  async getAnalyticsTaskStatus(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Request() req,
  ) {
    const task = await this.analyticsService.getTaskStatus(taskId);
    if (!task) {
      return { found: false, message: 'Task not found or expired' };
    }

    return {
      found: true,
      task,
    };
  }

  @Post(':id/responses/:responseId/reprocess')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Reprocess a single response to regenerate analytics metadata' })
  @ApiResponse({ status: 200, description: 'Response reprocessed successfully' })
  @ApiResponse({ status: 404, description: 'Response not found' })
  async reprocessResponse(
    @Param('id') formId: string,
    @Param('responseId') responseId: string,
    @Request() req,
  ) {
    return this.analyticsService.reprocessSingleResponse(formId, responseId);
  }

  @Post(':id/responses/reprocess-all')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Reprocess all responses for a form to regenerate analytics metadata' })
  @ApiResponse({ status: 200, description: 'All responses queued for reprocessing' })
  @ApiQuery({ name: 'onlyFailed', required: false, type: Boolean, description: 'Only reprocess responses that failed or were not processed' })
  async reprocessAllResponses(
    @Param('id') formId: string,
    @Request() req,
    @Query('onlyFailed') onlyFailed?: string,
  ) {
    const onlyFailedBool = onlyFailed === 'true';
    return this.analyticsService.reprocessAllResponses(formId, onlyFailedBool);
  }

  @Post(':id/send-invitations')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Send email invitations for a form' })
  @ApiResponse({ status: 200, description: 'Invitations sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid invitation data' })
  async sendInvitations(@Param('id') id: string, @Body() invitationData: any, @Request() req) {
    const userId = req.user._id || req.user.id;

    // Verify user owns the form and get form details
    // Note: FormOwnerGuard ensures ownership, but we need form details here.
    // Since we need details, we call findOne.
    const form = await this.formsService.findOne(id, userId);

    if (!form.isPublic) {
      throw new Error('Form must be public to send invitations');
    }

    // Generate the public form URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const formUrl = `${baseUrl}/form/${id}`;

    const emailData: SendInvitationDto = {
      formId: id,
      formTitle: form.title,
      formDescription: form.description,
      formUrl: formUrl,
      ...invitationData,
    };

    const results = await this.emailService.sendFormInvitation(emailData);

    return {
      success: true,
      message: 'Invitations processed',
      results: results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
    };
  }

  @Patch(':id/toggle-active')
  @UseGuards(FormOwnerGuard)
  @ApiOperation({ summary: 'Toggle form active status' })
  @ApiResponse({ status: 200, description: 'Form status toggled successfully' })
  toggleActive(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.formsService.toggleActiveStatus(id, userId);
  }
}

// Public forms controller (no authentication required)
@ApiTags('Public Forms')
@Controller('public/forms')
export class PublicFormsController {
  private readonly logger = new Logger(PublicFormsController.name);

  constructor(private readonly formsService: FormsService) { }

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint to verify public access' })
  async testPublicAccess() {
    return { message: 'Public access working', timestamp: new Date() };
  }

  @Get('debug/:id')
  @ApiOperation({ summary: 'Debug endpoint to check form status (no auth)' })
  async debugForm(@Param('id') id: string) {
    try {
      const form = await this.formsService.findOne(id);
      return {
        id: id,
        title: form.title,
        isPublic: form.isPublic,
        isActive: form.isActive,
        hasQuestions: form.questions.length > 0,
        questionCount: form.questions.length
      };
    } catch (error) {
      return {
        error: error.message,
        id: id
      };
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public form by ID (no authentication required)' })
  @ApiResponse({ status: 200, description: 'Public form retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Form not found or not public' })
  @ApiResponse({ status: 403, description: 'Form is not public' })
  async getPublicForm(@Param('id') id: string) {
    this.logger.log(`Public form request for ID: ${id}`);
    return this.formsService.findPublicForm(id);
  }

  @Post(':id/responses')
  @ApiOperation({ summary: 'Submit a response to a public form' })
  @ApiResponse({ status: 201, description: 'Response submitted successfully' })
  @ApiResponse({ status: 404, description: 'Form not found or not active' })
  @ApiResponse({ status: 400, description: 'Invalid response data' })
  async submitResponse(@Param('id') id: string, @Body() responseData: any, @Req() req: ExpressRequest) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    return this.formsService.submitResponse(id, responseData, ipAddress, userAgent);
  }
}