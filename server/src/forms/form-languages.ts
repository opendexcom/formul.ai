export const DEFAULT_FORM_LANGUAGE = 'en-US';

export const FORM_LANGUAGE_CODES = [
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en-US',
  'es',
  'et',
  'fi',
  'fr',
  'ga',
  'hr',
  'hu',
  'it',
  'lt',
  'lv',
  'mt',
  'nl',
  'pl',
  'pt',
  'ro',
  'sk',
  'sl',
  'sv',
  'nb',
  'uk',
  'tr',
] as const;

export type FormLanguage = (typeof FORM_LANGUAGE_CODES)[number];

export function resolveFormLanguage(language: unknown): FormLanguage {
  return FORM_LANGUAGE_CODES.includes(language as FormLanguage)
    ? (language as FormLanguage)
    : DEFAULT_FORM_LANGUAGE;
}
