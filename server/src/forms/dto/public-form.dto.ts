/**
 * Explicit allowlist for unauthenticated GET /api/public/forms/:id.
 * Query projection plus this mapper keep new schema fields from leaking by default.
 */

export const PUBLIC_FORM_SELECT = {
  title: 1,
  description: 1,
  questions: 1,
  settings: 1,
  isPublic: 1,
  isActive: 1,
  language: 1,
} as const;

/** Keys that always appear on the public form payload. */
export const PUBLIC_FORM_REQUIRED_KEYS = [
  'id',
  'title',
  'description',
  'questions',
  'settings',
] as const;

/** language is included only when present on the stored document. */
export const PUBLIC_FORM_ALLOWED_KEYS = [
  ...PUBLIC_FORM_REQUIRED_KEYS,
  'language',
] as const;

export const PUBLIC_QUESTION_ALLOWED_KEYS = [
  'id',
  'title',
  'description',
  'type',
  'required',
  'canBeOther',
  'otherPlaceholder',
  'options',
  'order',
  'validation',
] as const;

export const PUBLIC_SETTINGS_ALLOWED_KEYS = [
  'allowMultipleResponses',
  'requireLogin',
  'showProgressBar',
  'customTheme',
] as const;

export const PUBLIC_THEME_ALLOWED_KEYS = [
  'primaryColor',
  'backgroundColor',
  'fontFamily',
] as const;

export type PublicFormAllowedKey = (typeof PUBLIC_FORM_ALLOWED_KEYS)[number];

export interface PublicFormQuestionDto {
  id: string;
  title: string;
  description?: string;
  type: string;
  required: boolean;
  canBeOther?: boolean;
  otherPlaceholder?: string;
  options?: string[];
  order: number;
  validation?: Record<string, unknown>;
}

export interface PublicFormThemeDto {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

export interface PublicFormSettingsDto {
  allowMultipleResponses: boolean;
  requireLogin: boolean;
  showProgressBar: boolean;
  customTheme?: PublicFormThemeDto;
}

export interface PublicFormDto {
  id: string;
  title: string;
  description: string;
  questions: PublicFormQuestionDto[];
  settings: PublicFormSettingsDto;
  language?: string;
}

type LeanPublicForm = {
  _id?: unknown;
  title?: unknown;
  description?: unknown;
  questions?: unknown;
  settings?: unknown;
  language?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickStringFields(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') {
      picked[key] = value;
    }
  }
  return picked;
}

export function toPublicQuestionDto(question: unknown): PublicFormQuestionDto {
  const source = asRecord(question) ?? {};
  const mapped: PublicFormQuestionDto = {
    id: typeof source.id === 'string' ? source.id : String(source.id ?? ''),
    title: typeof source.title === 'string' ? source.title : '',
    type: typeof source.type === 'string' ? source.type : 'text',
    required: Boolean(source.required),
    order: typeof source.order === 'number' ? source.order : Number(source.order ?? 0) || 0,
  };

  if (typeof source.description === 'string') {
    mapped.description = source.description;
  }
  if (typeof source.canBeOther === 'boolean') {
    mapped.canBeOther = source.canBeOther;
  }
  if (typeof source.otherPlaceholder === 'string') {
    mapped.otherPlaceholder = source.otherPlaceholder;
  }
  if (Array.isArray(source.options)) {
    mapped.options = source.options.filter((option): option is string => typeof option === 'string');
  }
  if (asRecord(source.validation)) {
    mapped.validation = source.validation as Record<string, unknown>;
  }

  return mapped;
}

export function toPublicSettingsDto(settings: unknown): PublicFormSettingsDto {
  const source = asRecord(settings) ?? {};
  const mapped: PublicFormSettingsDto = {
    allowMultipleResponses: source.allowMultipleResponses !== false,
    requireLogin: Boolean(source.requireLogin),
    showProgressBar: source.showProgressBar !== false,
  };

  const theme = asRecord(source.customTheme);
  if (theme) {
    const customTheme = pickStringFields(theme, PUBLIC_THEME_ALLOWED_KEYS);
    if (Object.keys(customTheme).length > 0) {
      mapped.customTheme = customTheme;
    }
  }

  return mapped;
}

export function toPublicFormDto(form: LeanPublicForm): PublicFormDto {
  const questions = Array.isArray(form.questions)
    ? form.questions.map(toPublicQuestionDto)
    : [];

  const dto: PublicFormDto = {
    id: String(form._id ?? ''),
    title: typeof form.title === 'string' ? form.title : '',
    description: typeof form.description === 'string' ? form.description : '',
    questions,
    settings: toPublicSettingsDto(form.settings),
  };

  if (typeof form.language === 'string' && form.language.length > 0) {
    dto.language = form.language;
  }

  return dto;
}
