import type { NormalizedCommand } from '../adapters/integration-adapter.interface';

const CREATE_STUDY_KEYWORDS = [
  'new-study',
  'create-study',
  'create_study',
  'createstudy',
] as const;

const FORMULAI_PREFIX = '/formulai';

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && char.trim() === '';
}

function isHelpCommand(text: string): boolean {
  if (text.length === 0) {
    return true;
  }

  const lower = text.toLowerCase();
  if (lower === 'help') {
    return true;
  }

  let searchFrom = 0;
  while (searchFrom < lower.length) {
    const at = lower.indexOf(FORMULAI_PREFIX, searchFrom);
    if (at === -1) {
      break;
    }

    let pos = at + FORMULAI_PREFIX.length;
    while (pos < lower.length && isWhitespace(lower[pos])) {
      pos += 1;
    }

    if (lower.startsWith('help', pos)) {
      return true;
    }

    searchFrom = at + 1;
  }

  return false;
}

function isTokenBoundary(text: string, index: number): boolean {
  return index === 0 || isWhitespace(text[index - 1]);
}

function parseStudyName(rawName: string): string | null {
  if (!rawName) {
    return null;
  }

  const quote = rawName[0];
  if (
    (quote === '"' || quote === "'") &&
    rawName.length >= 2 &&
    rawName[rawName.length - 1] === quote
  ) {
    const inner = rawName.slice(1, -1).trim();
    return inner.length > 0 ? inner : null;
  }

  const name = rawName.trim();
  return name.length > 0 ? name : null;
}

function findCreateStudyName(text: string): string | null {
  const lower = text.toLowerCase();
  let commandAt = -1;
  let commandLength = 0;

  for (const keyword of CREATE_STUDY_KEYWORDS) {
    let searchFrom = 0;
    while (searchFrom < lower.length) {
      const at = lower.indexOf(keyword, searchFrom);
      if (at === -1) {
        break;
      }

      const after = at + keyword.length;
      if (isTokenBoundary(text, at) && after < text.length && isWhitespace(text[after])) {
        if (commandAt === -1 || at < commandAt) {
          commandAt = at;
          commandLength = keyword.length;
        }
        break;
      }

      searchFrom = at + 1;
    }
  }

  if (commandAt === -1) {
    return null;
  }

  let nameStart = commandAt + commandLength;
  while (nameStart < text.length && isWhitespace(text[nameStart])) {
    nameStart += 1;
  }

  return parseStudyName(text.slice(nameStart));
}

export function parseTextCommand(
  rawText: string,
  externalUserId?: string,
  externalChannelId?: string,
): NormalizedCommand {
  const text = rawText.trim();

  if (isHelpCommand(text)) {
    return {
      type: 'help',
      args: {},
      rawText: text,
      externalUserId,
      externalChannelId,
    };
  }

  const name = findCreateStudyName(text);
  if (name) {
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
