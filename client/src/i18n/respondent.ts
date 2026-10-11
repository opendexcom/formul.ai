import { DEFAULT_FORM_LANGUAGE, FORM_LANGUAGE_CODES, type FormLanguage } from './languages';

export type { FormLanguage };
export { DEFAULT_FORM_LANGUAGE, FORM_LANGUAGE_CODES };

const localeModules = import.meta.glob('./locales/*.json', { eager: true }) as Record<
  string,
  { default?: Record<string, string> } & Record<string, string>
>;

function loadTranslations(): Record<string, Record<string, string>> {
  const translations: Record<string, Record<string, string>> = {};
  for (const [path, mod] of Object.entries(localeModules)) {
    const code = path.match(/\/([^/]+)\.json$/)?.[1];
    if (!code) continue;
    translations[code] = mod.default ?? mod;
  }
  return translations;
}

export const translations = loadTranslations();

export function resolveFormLanguage(language: unknown): FormLanguage {
  return FORM_LANGUAGE_CODES.includes(language as FormLanguage)
    ? (language as FormLanguage)
    : DEFAULT_FORM_LANGUAGE;
}

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : match,
  );
}

export function t(
  key: string,
  language?: unknown,
  vars?: Record<string, string | number>,
): string {
  const lang = resolveFormLanguage(language);
  const table = translations[lang] ?? translations[DEFAULT_FORM_LANGUAGE] ?? {};
  const fallback = translations[DEFAULT_FORM_LANGUAGE] ?? {};
  const value = table[key] ?? fallback[key] ?? key;
  return interpolate(value, vars);
}

export function getFormLanguage(form?: {
  language?: unknown;
  settings?: { language?: unknown };
} | null): FormLanguage {
  if (!form) return DEFAULT_FORM_LANGUAGE;
  return resolveFormLanguage(form.language ?? form.settings?.language);
}

export function getTranslationKeys(language: string = DEFAULT_FORM_LANGUAGE): string[] {
  return Object.keys(translations[language] ?? {}).sort();
}
