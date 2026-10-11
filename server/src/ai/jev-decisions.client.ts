import {
  JEV_DEFAULT_MODEL,
  OPENROUTER_DECISIONS_URL,
} from './llm-provider.config';
import type { LlmUsage } from './llm.types';

export type JevQuestion =
  | {
      type: 'noul';
      instructions: string;
      criteria?: { true: string; false: string };
    }
  | {
      type: 'choice';
      instructions: string;
      criteria: Record<string, string>;
    }
  | {
      type: 'score';
      instructions: string;
      criteria: string[];
    };

export type JevAnswer = {
  type?: string;
  choice?: string;
  probability?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
  score?: number;
  legend?: Record<string, string>;
};

export class JevDecisionsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
    readonly dataCollectionDenied?: boolean,
  ) {
    super(message);
    this.name = 'JevDecisionsError';
  }
}

export interface JevDecisionsRequest {
  apiKey: string;
  model?: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
  sessionId?: string;
  dataCollection?: 'deny' | 'allow';
  referer?: string;
  title?: string;
  fetchImpl?: typeof fetch;
}

export interface JevDecisionsResult {
  answers: Record<string, JevAnswer>;
  usage: LlmUsage;
  raw: unknown;
  dataCollection: 'deny' | 'allow';
}

function looksLikeDataCollectionBlock(status: number, body: string): boolean {
  const lower = body.toLowerCase();
  return (
    status === 400 ||
    status === 404 ||
    lower.includes('data_collection') ||
    lower.includes('no available providers') ||
    lower.includes('no endpoints found') ||
    lower.includes('data collection')
  );
}

function extractUsage(raw: Record<string, unknown>, model: string): LlmUsage {
  const usage = (raw.usage ?? {}) as Record<string, unknown>;
  const promptTokens =
    Number(usage.prompt_tokens ?? usage.promptTokens ?? usage.input_tokens ?? 0) ||
    0;
  const completionTokens =
    Number(
      usage.completion_tokens ??
        usage.completionTokens ??
        usage.output_tokens ??
        0,
    ) || 0;
  const totalTokens =
    Number(usage.total_tokens ?? usage.totalTokens ?? 0) ||
    promptTokens + completionTokens;
  return {
    model,
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function extractAnswers(raw: Record<string, unknown>): Record<string, JevAnswer> {
  const answers = raw.answers ?? raw.result ?? raw.decisions;
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    return answers as Record<string, JevAnswer>;
  }
  return {};
}

async function postDecisions(
  params: JevDecisionsRequest,
  dataCollection: 'deny' | 'allow',
): Promise<JevDecisionsResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const model = params.model || JEV_DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    model,
    state: params.state,
    questions: params.questions,
    provider: { data_collection: dataCollection },
  };
  if (params.sessionId) {
    body.session_id = params.sessionId;
  }

  const response = await fetchImpl(OPENROUTER_DECISIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': params.referer || 'https://formulai.cloud',
      'X-Title': params.title || 'FormulAI',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new JevDecisionsError(
      `OpenRouter Decisions ${response.status}: ${text.slice(0, 400)}`,
      response.status,
      text,
      looksLikeDataCollectionBlock(response.status, text),
    );
  }

  const raw = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  return {
    answers: extractAnswers(raw),
    usage: extractUsage(raw, model),
    raw,
    dataCollection,
  };
}

/**
 * Call OpenRouter Decisions (`typesafe/jev-1.13` by default).
 * Sends `provider.data_collection=deny` first. If routing rejects that,
 * retries once without deny and logs via the returned `dataCollection` flag.
 */
export async function invokeJevDecisions(
  params: JevDecisionsRequest,
): Promise<JevDecisionsResult> {
  const preferred = params.dataCollection ?? 'deny';
  try {
    return await postDecisions(params, preferred);
  } catch (error) {
    if (
      preferred === 'deny' &&
      error instanceof JevDecisionsError &&
      error.dataCollectionDenied
    ) {
      console.warn(
        '[jev] data_collection=deny rejected by OpenRouter routing; retrying without deny. TypeSafe is US-hosted and does not train on inputs; ZDR is enterprise-only.',
      );
      return postDecisions(params, 'allow');
    }
    throw error;
  }
}

export function jevChoice(
  answers: Record<string, JevAnswer>,
  id: string,
): string | undefined {
  const answer = answers[id];
  if (!answer) return undefined;
  if (typeof answer.choice === 'string' && answer.choice.length > 0) {
    return answer.choice;
  }
  const probs = answer.probabilities;
  if (probs && typeof probs === 'object') {
    let best: string | undefined;
    let bestP = -1;
    for (const [key, value] of Object.entries(probs)) {
      if (typeof value === 'number' && value > bestP) {
        best = key;
        bestP = value;
      }
    }
    return best;
  }
  return undefined;
}

export function jevConfidence(
  answers: Record<string, JevAnswer>,
  id: string,
): number {
  const answer = answers[id];
  if (!answer) return 0.5;
  if (typeof answer.confidence === 'number') {
    return clamp01(answer.confidence);
  }
  if (typeof answer.probability === 'number') {
    return clamp01(answer.probability);
  }
  return 0.5;
}

export function jevNoulTrue(
  answers: Record<string, JevAnswer>,
  id: string,
): boolean {
  const answer = answers[id];
  if (!answer) return false;
  if (typeof answer.choice === 'string') {
    return answer.choice === 'true' || answer.choice === 'yes';
  }
  if (typeof answer.probability === 'number') {
    return answer.probability >= 0.5;
  }
  const choice = jevChoice(answers, id);
  return choice === 'true' || choice === 'yes';
}

export function jevScore01(
  answers: Record<string, JevAnswer>,
  id: string,
  levels: number,
): number {
  const answer = answers[id];
  if (!answer || typeof answer.score !== 'number' || levels <= 1) {
    return 0.5;
  }
  return clamp01(answer.score / (levels - 1));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}
