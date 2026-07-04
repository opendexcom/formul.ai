import type { NormalizedCommand } from '../adapters/integration-adapter.interface';

const CREATE_STUDY_PATTERN =
  /(?:^|\s)(?:\/formulai\s+)?(?:new-study|create[_-]?study)\s+(?:"([^"]+)"|'([^']+)'|(\S.+))$/i;

export function parseTextCommand(
  rawText: string,
  externalUserId?: string,
  externalChannelId?: string,
): NormalizedCommand {
  const text = rawText.trim();

  if (!text || /^help$/i.test(text) || /\/formulai\s*help/i.test(text)) {
    return {
      type: 'help',
      args: {},
      rawText: text,
      externalUserId,
      externalChannelId,
    };
  }

  const createMatch = text.match(CREATE_STUDY_PATTERN);
  if (createMatch) {
    const name = (createMatch[1] || createMatch[2] || createMatch[3] || '').trim();
    return {
      type: 'create_study',
      args: { name },
      rawText: text,
      externalUserId,
      externalChannelId,
    };
  }

  return {
    type: 'unknown',
    args: {},
    rawText: text,
    externalUserId,
    externalChannelId,
  };
}

export function parseJsonCommand(body: Record<string, unknown>): NormalizedCommand {
  const command = String(body.command ?? body.type ?? '').trim().toLowerCase();
  const name = String(body.name ?? body.studyName ?? body.title ?? '').trim();

  if (command === 'help') {
    return { type: 'help', args: {}, rawText: 'help' };
  }

  if (command === 'create_study' || command === 'create-study' || command === 'new-study') {
    return {
      type: 'create_study',
      args: { name },
      rawText: name ? `create_study ${name}` : 'create_study',
    };
  }

  return { type: 'unknown', args: {}, rawText: command || JSON.stringify(body) };
}
