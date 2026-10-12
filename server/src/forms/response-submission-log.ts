export interface ResponseSubmissionLogMeta {
  formId: string;
  responseId?: string;
  answerCount: number;
  durationMs?: number;
}

/**
 * Non-identifying metadata for response-submission logs.
 * Never include answer bodies, emails, IPs, or user agents.
 */
export function buildResponseSubmissionLogMeta(
  meta: ResponseSubmissionLogMeta,
): ResponseSubmissionLogMeta {
  return {
    formId: meta.formId,
    ...(meta.responseId !== undefined ? { responseId: meta.responseId } : {}),
    answerCount: meta.answerCount,
    ...(meta.durationMs !== undefined ? { durationMs: meta.durationMs } : {}),
  };
}

export function serializeLogArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}
