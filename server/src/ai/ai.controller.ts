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
/** Max characters of page text per chunk prompt (excerpt only). */
const MAX_CHUNK_BODY_CHARS = 14000;
/** Pages grouped per LLM map call. */
const PAGES_PER_CHUNK = 1;

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
  pages: { pageNumber: number; text: string }[];
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
  const pages: { pageNumber: number; text: string }[] = [];
  for (let i = 0; i < totalPages; i++) {
    const page = pdfData.Pages[i];
    const texts: any[] = Array.isArray(page?.Texts) ? page.Texts : [];
    const pageText = texts
      .flatMap((tx) => (Array.isArray(tx?.R) ? tx.R : []))
      .map((r) => decodedText(r?.T))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ pageNumber: i + 1, text: pageText });
    if (pageText) pagesText.push(`[Page ${i + 1}] ${pageText}`);
  }

  return {
    extractedText: pagesText.join('\n'),
    pages,
    totalPages,
    info,
    metadata,
  };
}

function buildPageChunks(
  pages: { pageNumber: number; text: string }[],
  pagesPerChunk: number,
): Array<{
  chunkIndex: number;
  fromPage: number;
  toPage: number;
  text: string;
}> {
  if (pages.length === 0) {
    return [
      {
        chunkIndex: 0,
        fromPage: 0,
        toPage: 0,
        text: '[No extractable text found in PDF]',
      },
    ];
  }
  const chunks: Array<{
    chunkIndex: number;
    fromPage: number;
    toPage: number;
    text: string;
  }> = [];
  for (let i = 0; i < pages.length; i += pagesPerChunk) {
    const slice = pages.slice(i, i + pagesPerChunk);
    const text = slice
      .map((p) =>
        p.text.trim()
          ? `[Page ${p.pageNumber}] ${p.text}`
          : `[Page ${p.pageNumber}]`,
      )
      .join('\n');
    const trimmed =
      text.length > MAX_CHUNK_BODY_CHARS
        ? `${text.slice(0, MAX_CHUNK_BODY_CHARS)}\n[... excerpt truncated ...]`
        : text;
    chunks.push({
      chunkIndex: chunks.length,
      fromPage: slice[0].pageNumber,
      toPage: slice[slice.length - 1].pageNumber,
      text: trimmed,
    });
  }
  return chunks;
}

function tryParseLlmJson(content: string): unknown | null {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  const trimmed = content.trim();
  let p = tryParse(trimmed);
  if (p) return p;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    p = tryParse(fence[1].trim());
    if (p) return p;
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    p = tryParse(trimmed.slice(start, end + 1));
    if (p) return p;
  }
  return null;
}

function mergeMapResults(
  mapResults: unknown[],
): { sections: Array<{ sectionTitle: string; questions: unknown[] }> } {
  const sections: Array<{ sectionTitle: string; questions: unknown[] }> = [];
  for (const raw of mapResults) {
    if (!raw || typeof raw !== 'object') continue;
    const secs = (raw as { sections?: unknown }).sections;
    if (!Array.isArray(secs)) continue;
    for (const sec of secs) {
      if (!sec || typeof sec !== 'object') continue;
      const sectionTitle = String(
        (sec as { sectionTitle?: unknown }).sectionTitle || 'Untitled section',
      );
      const questions = (sec as { questions?: unknown }).questions;
      sections.push({
        sectionTitle,
        questions: Array.isArray(questions) ? questions : [],
      });
    }
  }
  return { sections };
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
    const { extractedText, pages, totalPages, info, metadata } =
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
    const chunks = buildPageChunks(pages, PAGES_PER_CHUNK);
    const currentForm = currentFormStr ? safeParseJson(currentFormStr) : undefined;
    const isRefine = mode === 'refine' && currentForm;

    const documentFormRules = `
## STRICT PARSING RULES — READ BEFORE GENERATING ANY OUTPUT

---

### 1. IDENTIFY FORM STRUCTURE FIRST
Before generating any questions, scan the entire PDF and identify:
- All loose fields at the very top/header of the document BEFORE any named section. DO NOT skip them!
- All named sections/chapters (e.g. "Section A", "Part II", "Dane podatnika")
- All tables with repeating rows
- Checkboxes, radio groups, dropdowns vs. free-text inputs
- Required vs. optional fields (if indicated)

---

### 2. TABLES — EXPAND ROWS, DO NOT FLATTEN
If the PDF contains a table where each row represents a distinct category/item:
- Generate one question PER ROW PER COLUMN that a submitter fills in
- Do NOT merge all rows into a single open-ended field


---

### 3. STRICT RULES FOR OPTIONS (select / boolean fields)
- Options MUST come ONLY from the PDF text — do NOT invent or assume values
- Do NOT add "Other / Inny / Другое" unless the PDF explicitly lists it
- If a field has exactly N options in the PDF, output EXACTLY those N — nothing more, nothing less
- If you cannot confidently extract options, fall back to type "text" instead of guessing
- Do NOT set canBeOther: true unless the PDF explicitly shows an open "other" option

---

### 4. SECTION GROUPING & HEADERS
Preserve the PDF's section hierarchy in the output:
- Fields at the very beginning of the document MUST be included.
- Map each PDF section/part to a section in the schema
- Use the original section title from the PDF (translate only if the target schema language differs)
- Fields must appear in the same order as in the PDF — do NOT reorder

`;

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

    const emitStep = (step: {
      step: string;
      message: string;
      status: 'pending' | 'in-progress' | 'completed' | 'error';
      data?: unknown;
      usage?: unknown;
    }) => {
      if (clientClosed) return;
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
    };

    try {
      emitStep({
        step: 'document_parse',
        message: `Parsed PDF: ${totalPages} page(s), ${chunks.length} chunk(s)`,
        status: 'completed',
        data: { totalPages, chunkCount: chunks.length },
      });

      const mapResults: unknown[] = [];
      const mapJsonHint = `Respond ONLY with valid JSON (no prose, no markdown). Shape:
{ "sections": [ { "sectionTitle": string, "questions": [ { "id"?: string, "title": string, "type": string, "description"?: string, "required": boolean, "options"?: string[], "canBeOther"?: boolean, "otherPlaceholder"?: string, "order"?: number } ] } ] }
Question types allowed: text, textarea, multiple_choice, checkbox, dropdown, email, number, date, time, rating, comment.
Use "comment" for static instructions only (no answer). For choice fields, options must come only from the excerpt.`;

      for (const ch of chunks) {
        emitStep({
          step: `chunk_${ch.chunkIndex}`,
          message: `Extracting pages ${ch.fromPage}–${ch.toPage}...`,
          status: 'in-progress',
        });

        const mapPrompt = `${userPrompt}

Document metadata:
${documentContext}

You are extracting form fields from ONE excerpt of the document below. Only use information present in this excerpt.

${mapJsonHint}

${documentFormRules}

--- DOCUMENT EXCERPT (pages ${ch.fromPage}–${ch.toPage}) ---
${ch.text}`;

        const { content, usage } =
          await this.aiService.analyzeTextWithUsage(mapPrompt);
        const parsed = tryParseLlmJson(content);
        if (!parsed || typeof parsed !== 'object') {
          emitStep({
            step: `chunk_${ch.chunkIndex}`,
            message: `Failed to parse model output for pages ${ch.fromPage}–${ch.toPage}`,
            status: 'error',
          });
          throw new Error('Map step returned invalid JSON');
        }
        mapResults.push(parsed);
        const qCount = Array.isArray((parsed as { sections?: unknown }).sections)
          ? (parsed as { sections: { questions?: unknown[] }[] }).sections.reduce(
              (n, s) =>
                n + (Array.isArray(s?.questions) ? s.questions.length : 0),
              0,
            )
          : 0;
        emitStep({
          step: `chunk_${ch.chunkIndex}`,
          message: `Extracted ${qCount} question(s) from pages ${ch.fromPage}–${ch.toPage}`,
          status: 'completed',
          data: {
            fromPage: ch.fromPage,
            toPage: ch.toPage,
            questionCount: qCount,
          },
          usage,
        });
      }

      const merged = mergeMapResults(mapResults);
      const totalMergedQuestions = merged.sections.reduce(
        (n, s) => n + s.questions.length,
        0,
      );
      emitStep({
        step: 'merge_done',
        message: `Merged draft: ${merged.sections.length} section(s), ${totalMergedQuestions} question(s)`,
        status: 'completed',
        data: {
          sectionCount: merged.sections.length,
          questionCount: totalMergedQuestions,
        },
      });

      emitStep({
        step: 'validate',
        message: 'Validating and building final form...',
        status: 'in-progress',
      });

      const refineBlock =
        isRefine && currentForm
          ? `Existing form to refine (keep questions that still apply; align with the draft extracted from the PDF):\n${JSON.stringify(currentForm, null, 2)}\n\n`
          : '';

      const validatePrompt = `${userPrompt}

Document metadata:
${documentContext}

${refineBlock}Below is a merged DRAFT built from sequential excerpts of the same PDF (sections may overlap or duplicate). Your job:
1. Merge overlapping questions, remove true duplicates, preserve reasonable order matching the document flow.
2. Produce title and description for the whole form.
3. Output a SINGLE flat list of questions in field "questions". Use type "comment" for section instructions if needed.
4. MAIN VALIDATION GOAL: Check if the currently added questions are exactly the same as in the PDF. Ensure that absolutely nothing is missing from the document, and there are no extra fields or elements that are not present in the original document. 

Draft JSON:
${JSON.stringify(merged, null, 2)}

--- FULL PDF DOCUMENT TEXT FOR VERIFICATION ---
${extractedText}
-----------------------------------------------

Respond ONLY with valid JSON (no prose, no markdown). Shape:
{ "title": string, "description": string, "questions": [ { "id"?: string, "title": string, "type": string, "description"?: string, "required": boolean, "options"?: string[], "canBeOther"?: boolean, "otherPlaceholder"?: string, "order": number } ] }

Question types: text, textarea, multiple_choice, checkbox, dropdown, email, number, date, time, rating, comment.
Set "order" from 0 upward. When canBeOther is true, the last option in "options" MUST use prefix "__OTHER__:" plus the label (e.g. "__OTHER__:Other"), and put free-text hint in otherPlaceholder.`;

      const { content: validateContent, usage: validateUsage } =
        await this.aiService.analyzeTextWithUsage(validatePrompt);
      const validated = tryParseLlmJson(validateContent);
      if (!validated || typeof validated !== 'object') {
        emitStep({
          step: 'validate',
          message: 'Validation step returned invalid JSON',
          status: 'error',
        });
        throw new Error('Validation step returned invalid JSON');
      }

      let finalForm: ReturnType<AiService['sanitizeAiFormOutput']>;
      try {
        finalForm = this.aiService.sanitizeAiFormOutput(validated);
      } catch (sanitizeErr: unknown) {
        console.error(
          '[AI Generate Stream From Document] sanitize failed:',
          sanitizeErr,
        );
        emitStep({
          step: 'validate',
          message: 'Model output could not be converted to a valid form',
          status: 'error',
        });
        throw sanitizeErr;
      }

      emitStep({
        step: 'validate',
        message: 'Validation complete',
        status: 'completed',
        usage: validateUsage,
      });

      emitStep({
        step: 'generate',
        message: 'Form generated successfully!',
        status: 'completed',
        data: finalForm,
        usage: validateUsage,
      });

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
