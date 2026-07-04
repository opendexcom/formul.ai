import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProjectDto, AddProjectVariantDto, UpdateProjectDto, UpdateProjectVariantDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';
import { ComparativeReportService } from './comparative-report.service';
import { StudyAnalysisService } from './study-analysis.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly comparativeReportService: ComparativeReportService,
    private readonly studyAnalysisService: StudyAnalysisService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  create(@Body() dto: CreateProjectDto, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects for current user' })
  findAll(@Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.findAllByUser(userId);
  }

  @Get('dashboard-summary')
  @ApiOperation({ summary: 'Get dashboard metrics and study list summary' })
  getDashboardSummary(@Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.getDashboardSummary(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details' })
  findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project metadata' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.update(id, dto, userId);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive project' })
  archive(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.archive(id, userId);
  }

  @Post(':id/variants')
  @ApiOperation({ summary: 'Add a new A/B test variant cloned from an existing variant' })
  addVariant(@Param('id') id: string, @Body() dto: AddProjectVariantDto, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.addVariant(id, dto, userId);
  }

  @Patch(':id/variants/:key')
  @ApiOperation({ summary: 'Update variant research metadata' })
  updateVariant(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() dto: UpdateProjectVariantDto,
    @Request() req,
  ) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.updateVariant(id, key, dto, userId);
  }

  @Get(':id/responses')
  @ApiOperation({ summary: 'Get responses aggregated across project variants' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'variant', required: false, enum: ['main', 'A', 'B'] })
  getResponses(
    @Param('id') id: string,
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('variant') variant?: 'main' | 'A' | 'B',
  ) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.getProjectResponses(id, userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      variant,
    });
  }

  @Get(':id/comparative-report/readiness')
  @ApiOperation({ summary: 'Check if project is ready for comparative report generation' })
  getComparativeReportReadiness(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.comparativeReportService.checkReadiness(id, userId);
  }

  @Get(':id/comparative-report')
  @ApiOperation({ summary: 'Get cached comparative report' })
  getComparativeReport(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.comparativeReportService.getComparativeReport(id, userId);
  }

  @Post(':id/comparative-report')
  @ApiOperation({ summary: 'Generate comparative report (non-streaming)' })
  async generateComparativeReport(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    const taskId = randomUUID();
    const report = await this.comparativeReportService.generateComparativeReport(
      id,
      userId,
      taskId,
    );
    return { projectId: id, comparativeReport: report };
  }

  @Get(':id/comparative-report/stream')
  @ApiOperation({ summary: 'Generate comparative report with SSE progress streaming' })
  @ApiQuery({ name: 'taskId', required: false })
  async streamComparativeReport(
    @Param('id') id: string,
    @Req() reqExpress: ExpressRequest,
    @Res() res: ExpressResponse,
    @Query('taskId') existingTaskId?: string,
  ) {
    const authHeader = reqExpress.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const token = authHeader.substring(7);
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub;

      let taskId: string;
      if (existingTaskId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(existingTaskId)) {
          res.status(400).json({ message: 'Invalid taskId format' });
          return;
        }
        taskId = existingTaskId;
      } else {
        taskId = randomUUID();
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      res.write(
        `data: ${JSON.stringify({
          type: 'connected',
          message: 'Started comparative report generation',
          taskId,
        })}\n\n`,
      );

      let unsubscribed = false;
      const unsubscribe = await this.comparativeReportService.onProgress((update: any) => {
        if (update.taskId !== taskId) return;
        res.write(`data: ${JSON.stringify(update)}\n\n`);
        if (update.type === 'complete' || update.type === 'error') {
          if (!unsubscribed) {
            unsubscribed = true;
            unsubscribe().finally(() => res.end());
          }
        }
      });

      void this.comparativeReportService
        .generateComparativeReport(id, userId, taskId)
        .catch(() => {
          // errors published via progress channel
        });

      reqExpress.on('close', () => {
        if (!unsubscribed) {
          unsubscribed = true;
          unsubscribe().catch(() => undefined);
        }
      });
    } catch {
      res.status(401).json({ message: 'Authentication failed' });
    }
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get study-level analysis' })
  getAnalytics(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.studyAnalysisService.getStudyAnalysis(id, userId);
  }

  @Post(':id/analytics')
  @ApiOperation({ summary: 'Start study-level analysis generation' })
  startStudyAnalytics(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    const taskId = randomUUID();
    void this.studyAnalysisService
      .generateStudyAnalysis(id, userId, taskId)
      .catch(() => undefined);
    return { projectId: id, taskId, status: 'queued' };
  }

  @Get(':id/analytics/stream')
  @ApiOperation({ summary: 'Generate study analysis with SSE progress streaming' })
  @ApiQuery({ name: 'taskId', required: false })
  async streamStudyAnalytics(
    @Param('id') id: string,
    @Req() reqExpress: ExpressRequest,
    @Res() res: ExpressResponse,
    @Query('taskId') existingTaskId?: string,
  ) {
    const authHeader = reqExpress.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const token = authHeader.substring(7);
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub;

      let taskId: string;
      if (existingTaskId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(existingTaskId)) {
          res.status(400).json({ message: 'Invalid taskId format' });
          return;
        }
        taskId = existingTaskId;
      } else {
        taskId = randomUUID();
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      res.write(
        `data: ${JSON.stringify({
          type: 'connected',
          message: 'Started study analysis generation',
          taskId,
        })}\n\n`,
      );

      let unsubscribed = false;
      const unsubscribe = await this.studyAnalysisService.onProgress((update: any) => {
        if (update.taskId !== taskId) return;
        res.write(`data: ${JSON.stringify(update)}\n\n`);
        if (update.type === 'complete' || update.type === 'error') {
          if (!unsubscribed) {
            unsubscribed = true;
            unsubscribe().finally(() => res.end());
          }
        }
      });

      void this.studyAnalysisService
        .generateStudyAnalysis(id, userId, taskId)
        .catch(() => undefined);

      reqExpress.on('close', () => {
        if (!unsubscribed) {
          unsubscribed = true;
          unsubscribe().catch(() => undefined);
        }
      });
    } catch {
      res.status(401).json({ message: 'Authentication failed' });
    }
  }

  @Post(':id/report')
  @ApiOperation({ summary: 'Generate project report snapshot' })
  generateReport(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.generateProjectReport(id, userId);
  }

  @Post(':id/report/send')
  @ApiOperation({ summary: 'Send project report by email' })
  sendReport(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.projectsService.sendProjectReport(id, userId);
  }
}
