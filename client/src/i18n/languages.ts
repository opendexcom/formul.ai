export const DEFAULT_FORM_LANGUAGE: FormLanguage = 'en-US';

export const FORM_LANGUAGES = [
  { code: 'bg', nativeName: 'Български' },
  { code: 'cs', nativeName: 'Čeština' },
  { code: 'da', nativeName: 'Dansk' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'el', nativeName: 'Ελληνικά' },
  { code: 'en-US', nativeName: 'English' },
  { code: 'es', nativeName: 'Español' },
  { code: 'et', nativeName: 'Eesti' },
  { code: 'fi', nativeName: 'Suomi' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'ga', nativeName: 'Gaeilge' },
  { code: 'hr', nativeName: 'Hrvatski' },
  { code: 'hu', nativeName: 'Magyar' },
  { code: 'it', nativeName: 'Italiano' },
  { code: 'lt', nativeName: 'Lietuvių' },
  { code: 'lv', nativeName: 'Latviešu' },
  { code: 'mt', nativeName: 'Malti' },
  { code: 'nl', nativeName: 'Nederlands' },
  { code: 'pl', nativeName: 'Polski' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'ro', nativeName: 'Română' },
  { code: 'sk', nativeName: 'Slovenčina' },
  { code: 'sl', nativeName: 'Slovenščina' },
  { code: 'sv', nativeName: 'Svenska' },
  { code: 'nb', nativeName: 'Norsk bokmål' },
  { code: 'uk', nativeName: 'Українська' },
  { code: 'tr', nativeName: 'Türkçe' },
] as const;

export type FormLanguage = (typeof FORM_LANGUAGES)[number]['code'];

export const FORM_LANGUAGE_CODES: readonly FormLanguage[] = FORM_LANGUAGES.map(
  (language) => language.code,
);
