import { Form } from '../../schemas/form.schema';

const OPEN_ENDED_TYPES = new Set(['text', 'textarea']);

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Question titles / focus phrases that topics should not duplicate. */
export function extractQuestionFocusPhrases(form: Form): string[] {
  const phrases = new Set<string>();

  for (const question of form.questions || []) {
    if (!OPEN_ENDED_TYPES.has(question.type)) continue;

    const normalized = normalizeForMatch(question.title || '');
    if (!normalized) continue;

    phrases.add(normalized);

    const focusMatch = normalized.match(
      /\b(?:on|about|regarding|of|for)\s+(.+)$/,
    );
    if (focusMatch?.[1]?.trim()) {
      phrases.add(focusMatch[1].trim());
    }
  }

  return Array.from(phrases);
}

/** True when a topic merely restates an open-ended question subject. */
export function isQuestionEchoTopic(
  topic: string,
  questionFocusPhrases: string[],
): boolean {
  const normalizedTopic = normalizeForMatch(topic);
  if (normalizedTopic.length < 4) return false;

  for (const focus of questionFocusPhrases) {
    if (focus.length < 4) continue;

    if (focus === normalizedTopic) return true;

    const shorter =
      focus.length <= normalizedTopic.length ? focus : normalizedTopic;
    const longer =
      focus.length <= normalizedTopic.length ? normalizedTopic : focus;

    if (longer.includes(shorter) && shorter.length >= longer.length * 0.45) {
      return true;
    }
  }

  return false;
}

export function filterDiscoveredTopics(
  topics: string[],
  questionFocusPhrases: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const topic of topics) {
    if (typeof topic !== 'string' || !topic.trim()) continue;
    if (isQuestionEchoTopic(topic, questionFocusPhrases)) continue;

    const key = normalizeForMatch(topic);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(topic.trim());
  }

  return result;
}
