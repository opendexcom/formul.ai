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
    const documentFormRules = `
## STRICT PARSING RULES — READ BEFORE GENERATING ANY OUTPUT

---

### 1. IDENTIFY FORM STRUCTURE FIRST
Before generating any questions, scan the entire PDF and identify:
- All named sections/chapters (e.g. "Section A", "Part II", "Dane podatnika")
- All tables with repeating rows
- Fields visually distinguished as "office use only" (gray background, hatching, labels like "Do not write below", "For official use", "Wypełnia urząd", "Не заполняется", etc.)
- Checkboxes, radio groups, dropdowns vs. free-text inputs
- Required vs. optional fields (if indicated)

---

### 2. SKIP NON-SUBMITTER FIELDS
Some fields are reserved for staff/office use. Skip them entirely — do NOT generate questions for:
- Fields explicitly labeled as "office use only", "do not fill", "staff only", "wypełnia urząd", or equivalent in any language
- Fields visually marked as non-submitter (dark/gray shading, striped background, bordered "office" zones)
- Auto-calculated or pre-printed values (e.g. sequential document numbers, barcodes, stamps)

If you are unsure whether a field is submitter-facing, include it with a note in the hint field.

---

### 3. TABLES — EXPAND ROWS, DO NOT FLATTEN
If the PDF contains a table where each row represents a distinct category/item:
- Generate one question PER ROW PER COLUMN that a submitter fills in
- Use the pattern: "[Row label] – [Column label]" as the question title
- Example: "Foreign income – Amount", "Foreign income – Tax paid"
- Always include summary/total rows ("Total", "Razem", "Итого") as separate questions
- Do NOT merge all rows into a single open-ended field

If the table has a dynamic/unknown number of rows (e.g. "List all employers"), generate a repeatable question group instead of fixed rows.

---

### 4. FIELD TYPE INFERENCE
Infer the field type from visual and textual cues in the PDF:

| Cue in PDF | Output type |
|---|---|
| Currency amount, tax value, income | number |
| Date field, "DD-MM-YYYY", "Data" | date |
| Checkbox group / radio buttons | select |
| Yes/No, Tak/Nie, two exclusive options | boolean |
| Free text, name, address, description | text |
| NIP, PESEL, ID number (fixed-length) | text with appropriate hint |
| Signature field | skip (not a data field) |

---

### 5. STRICT RULES FOR OPTIONS (select / boolean fields)
- Options MUST come ONLY from the PDF text — do NOT invent or assume values
- Do NOT add "Other / Inny / Другое" unless the PDF explicitly lists it
- If a field has exactly N options in the PDF, output EXACTLY those N — nothing more, nothing less
- If you cannot confidently extract options, fall back to type "text" instead of guessing
- Do NOT set canBeOther: true unless the PDF explicitly shows an open "other" option

---

### 6. SECTION GROUPING
Preserve the PDF's section hierarchy in the output:
- Map each PDF section/part to a section in the schema
- Use the original section title from the PDF (translate only if the target schema language differs)
- Fields must appear in the same order as in the PDF — do NOT reorder

---

### 7. WHAT TO SKIP ENTIRELY
Do not generate questions for:
- Signature / date-of-signature fields (these are collected separately)
- Instructions, footnotes, and legal disclaimers that appear as text but have no input
- Fields pre-filled by the system (form version number, document code, revision date)
- Purely decorative or structural elements (headers, dividers)
`;

    const promptWithDocumentContext = `${userPrompt}

Document metadata:
${documentContext}

Document text:
${extractedText || '[No extractable text found in PDF]'}

${documentFormRules}`.slice(0, MAX_DOCUMENT_CONTEXT_CHARS);
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
