import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { pathToFileURL } from 'url';
import { AiService } from './ai.service';
import { GenerateAIFormDto } from './dto/generate-ai-form.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOCUMENT_CONTEXT_CHARS = 50000;
const MAX_EXTRACTED_TEXT_CHARS = 40000;

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).toString();

/** Uploaded file shape from Multer (memory storage) */
interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}
/** OpenAI document API accepts PDF only; we restrict to PDF to avoid 400 from the provider */
const ALLOWED_MIME_TYPES = ['application/pdf'];

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
    // Explicit 200 OK and SSE headers
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.FRONTEND_URL || 'http://localhost:3000',
    );
    // Flush headers so the client starts reading immediately
    // @ts-ignore - flushHeaders exists on Node's ServerResponse
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

    try {
      for await (const step of this.aiService.generateWithSteps(dto)) {
        if (clientClosed) break;
        res.write(`data: ${JSON.stringify(step)}\n\n`);
        // Optional: EE plugin attaches req.trackUsage to record token usage for streaming
        if (step.usage && typeof usageTrackingReq.trackUsage === 'function') {
          try {
            // Keep hook errors isolated so SSE success state stays consistent.
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
        // Sanitize error message to prevent XSS - use generic message
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

  @Post('generate-stream-from-document')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF or DOCX file' },
        prompt: { type: 'string', description: 'Optional instruction' },
        mode: { type: 'string', enum: ['generate', 'refine'] },
        currentForm: { type: 'string', description: 'JSON string of current form when refining' },
      },
    },
  })
  @ApiOperation({ summary: 'Generate form from an uploaded PDF document with streaming' })
  @ApiResponse({ status: 200, description: 'SSE stream of generation steps' })
  @ApiResponse({ status: 400, description: 'Invalid or missing file' })
  async generateStreamFromDocument(
    @UploadedFile() file: UploadedFile | undefined,
    @Body('prompt') prompt: string | undefined,
    @Body('mode') mode: string | undefined,
    @Body('currentForm') currentFormStr: string | undefined,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('A PDF document is required');
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024} MB`,
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF documents are supported. Please convert your file to PDF and try again.',
      );
    }
    const buffer = file.buffer;
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const totalPages = doc.numPages;
    const metadataResult = await doc.getMetadata().catch(() => ({
      info: null,
      metadata: null,
    }));
    const extractedPages: string[] = [];
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as Array<{ str?: string }>)
        .map((item) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) {
        extractedPages.push(`[Page ${pageNum}] ${pageText}`);
      }
      page.cleanup();
    }
    await doc.destroy();

    const metadataAny = metadataResult.metadata as unknown as { getAll?: () => unknown } | null;
    const rawMetadata =
      metadataAny && typeof metadataAny.getAll === 'function'
        ? metadataAny.getAll()
        : metadataResult.metadata;
    const extractedText = extractedPages
      .join('\n')
      .slice(0, MAX_EXTRACTED_TEXT_CHARS);
    const documentContext = JSON.stringify(
      {
        filename: file.originalname || 'document.pdf',
        pages: totalPages,
        info: metadataResult.info,
        metadata: rawMetadata,
      },
      null,
      2,
    );
    const userPrompt = (prompt?.trim() || 'Create a form based on this document.').slice(0, 10000);
    const promptWithDocumentContext = `${userPrompt}

Document metadata:
${documentContext}

Document text:
${extractedText || '[No extractable text found in PDF]'}`.slice(0, MAX_DOCUMENT_CONTEXT_CHARS);
    const dto: GenerateAIFormDto = {
      prompt: promptWithDocumentContext,
      mode: mode === 'refine' ? 'refine' : 'generate',
      currentForm: currentFormStr ? safeParseJson(currentFormStr) : undefined,
    };

    // Same SSE setup as generate-stream
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

    try {
      for await (const step of this.aiService.generateWithSteps(dto)) {
        if (clientClosed) break;
        res.write(`data: ${JSON.stringify(step)}\n\n`);
        if (step.usage && typeof usageTrackingReq.trackUsage === 'function') {
          try {
            void Promise.resolve(usageTrackingReq.trackUsage(step.usage)).catch(
              (trackUsageError: unknown) => {
                console.error('[AI Generate Stream From Document] trackUsage error:', trackUsageError);
              },
            );
          } catch (trackUsageError: unknown) {
            console.error('[AI Generate Stream From Document] trackUsage threw:', trackUsageError);
          }
        }
      }
      if (!clientClosed) res.end();
    } catch (error: any) {
      try {
        const safeErrorMsg = 'An error occurred during form generation';
        console.error('[AI Generate Stream From Document] Error:', error);
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

function safeParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}
