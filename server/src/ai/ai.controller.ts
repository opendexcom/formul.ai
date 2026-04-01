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
import { AiService } from './ai.service';
import { GenerateAIFormDto } from './dto/generate-ai-form.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
const PDFParser = require('pdf2json');

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOCUMENT_CONTEXT_CHARS = 50000;
const MAX_EXTRACTED_TEXT_CHARS = 40000;

/** Uploaded file shape from Multer (memory storage) */
interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}
/** OpenAI document API accepts PDF only; we restrict to PDF to avoid 400 from the provider */
const ALLOWED_MIME_TYPES = ['application/pdf'];

async function parsePdfWithPdf2Json(buffer: Buffer): Promise<{
  extractedText: string;
  totalPages: number;
  info: unknown;
  metadata: unknown;
}> {
  const parser = new PDFParser(undefined, 1);
  const pdfData: any = await new Promise((resolve, reject) => {
    parser.on('pdfParser_dataError', (err: any) =>
      reject(err?.parserError ?? err),
    );
    parser.on('pdfParser_dataReady', (data: any) => resolve(data));
    parser.parseBuffer(buffer);
  });

  const totalPages = Array.isArray(pdfData?.Pages) ? pdfData.Pages.length : 0;
  const info = pdfData?.Meta ?? null;
  const metadata = pdfData?.Info ?? null;

  const decodedText = (t: unknown) => {
    if (typeof t !== 'string') return '';
    try {
      return decodeURIComponent(t);
    } catch {
      return t;
    }
  };

  const pagesText: string[] = [];
  for (let i = 0; i < totalPages; i++) {
    const page = pdfData.Pages[i];
    const texts: any[] = Array.isArray(page?.Texts) ? page.Texts : [];
    const pageText = texts
      .flatMap((tx) => (Array.isArray(tx?.R) ? tx.R : []))
      .map((r) => decodedText(r?.T))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) pagesText.push(`[Page ${i + 1}] ${pageText}`);
  }

  return {
    extractedText: pagesText.join('\n'),
    totalPages,
    info,
    metadata,
  };
}

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
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF or DOCX file',
        },
        prompt: { type: 'string', description: 'Optional instruction' },
        mode: { type: 'string', enum: ['generate', 'refine'] },
        currentForm: {
          type: 'string',
          description: 'JSON string of current form when refining',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Generate form from an uploaded PDF document with streaming',
  })
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
    const { extractedText, totalPages, info, metadata } =
      await parsePdfWithPdf2Json(buffer);

    const documentContext = JSON.stringify(
      {
        filename: file.originalname || 'document.pdf',
        pages: totalPages,
        info,
        metadata,
      },
      null,
      2,
    );
    console.log('Document Context:', documentContext);
    const userPrompt = (
      prompt?.trim() || 'Create a form based on this document.'
    ).slice(0, 10000);
    const strictOptionsRules = `
## STRICT PARSING RULES — READ BEFORE GENERATING ANY OUTPUT

### 2. SKIP ALL GRAY / OFFICE-FILLED FIELDS
The PDF form header states: "POLA JASNE WYPEŁNIA SKŁADAJĄCY, POLA CIEMNE WYPEŁNIA URZĄD"
→ Gray/dark fields are filled by the tax office. DO NOT include them.
→ Specifically: fields like "Nr dokumentu" and "Status" are gray → SKIP entirely.
→ Only generate questions for white/light fields that the submitter fills in.

---

### 3. TABLE FIELDS — DO NOT FLATTEN
If the PDF contains a table (e.g. Section D: "Rodzaje przychodów"), do NOT collapse all rows into a single question.
Instead, generate one pair of questions (Przychody + Koszty) PER TABLE ROW, like this:
- title: "Odpłatne zbycie papierów wartościowych – Przychody", type: "number"
- title: "Odpłatne zbycie papierów wartościowych – Koszty uzyskania przychodów", type: "number"
Repeat for every row in the table. Include the "Razem / Suma" row as well.

---

### 4. STRICT RULES FOR OPTIONS
- Do NOT invent answer options. Options MUST come ONLY from the PDF text.
- Do NOT add "Inny" / "Other" unless the PDF explicitly lists it.
- If a field has exactly 2 possible answers in the PDF, output EXACTLY those 2 — nothing more.
- If you cannot confidently extract options from the PDF text, fall back to type "text" instead of guessing.
- Do NOT set canBeOther: true unless the PDF explicitly shows an "Other/Inny" option.
`;

    const promptWithDocumentContext = `${userPrompt}

Document metadata:
${documentContext}

Document text:
${extractedText || '[No extractable text found in PDF]'}

${strictOptionsRules}`.slice(0, MAX_DOCUMENT_CONTEXT_CHARS);
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
                console.error(
                  '[AI Generate Stream From Document] trackUsage error:',
                  trackUsageError,
                );
              },
            );
          } catch (trackUsageError: unknown) {
            console.error(
              '[AI Generate Stream From Document] trackUsage threw:',
              trackUsageError,
            );
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
