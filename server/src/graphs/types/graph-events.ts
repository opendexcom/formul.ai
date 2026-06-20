import type { LlmUsage } from '../../ai/llm.types';

/** SSE-compatible step event emitted by graph streaming. */
export interface GraphStepEvent {
  step: string;
  message: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  data?: unknown;
  usage?: LlmUsage;
}

export interface GraphRunOptions {
  sessionId?: string;
  userId?: string;
  formId?: string;
  tags?: Record<string, string>;
}
