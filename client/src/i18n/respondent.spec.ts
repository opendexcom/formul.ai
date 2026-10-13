import { describe, expect, it } from 'vitest';
import { FORM_LANGUAGE_CODES } from './languages';
import {
  DEFAULT_FORM_LANGUAGE,
  detectBrowserLanguage,
  getFormLanguage,
  getTranslationKeys,
  interpolate,
  resolveFormLanguage,
  t,
  translations,
} from './respondent';

describe('respondent i18n', () => {
  it('falls back to en-US for an unknown language', () => {
    expect(resolveFormLanguage('fr-FR')).toBe('en-US');
    expect(resolveFormLanguage(undefined)).toBe(DEFAULT_FORM_LANGUAGE);
    expect(t('submit', 'zz')).toBe('Submit');
    expect(t('required', 'unknown')).toBe('This field is required');
  });

  it('falls back to en-US when a key is missing from the selected language', () => {
    expect(t('__missing_key__', 'pl')).toBe('__missing_key__');
    expect(t('__missing_key__', 'en-US')).toBe('__missing_key__');
    expect(t('submit', 'pl')).toBe('Wyślij');
  });

  it('interpolates placeholders', () => {
    expect(interpolate('Page {current} of {total}', { current: 2, total: 5 })).toBe('Page 2 of 5');
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
    expect(t('submit', 'en-US', { unused: 1 })).toBe('Submit');
  });

  it('maps the browser locale to a supported respondent language', () => {
    expect(detectBrowserLanguage(['pl-PL', 'en-US'])).toBe('pl');
    expect(detectBrowserLanguage(['de'])).toBe('de');
    expect(detectBrowserLanguage(['en-GB'])).toBe('en-US');
    expect(detectBrowserLanguage(['xx-YY', 'fr'])).toBe('fr');
    expect(detectBrowserLanguage(['xx-YY'])).toBe('en-US');
    expect(detectBrowserLanguage([])).toBe(DEFAULT_FORM_LANGUAGE);
  });

  it('reads language from the form, falling back to en-US', () => {
    expect(getFormLanguage({ language: 'pl' })).toBe('pl');
    expect(getFormLanguage({ language: 'de' })).toBe('de');
    expect(getFormLanguage({})).toBe('en-US');
    expect(getFormLanguage(null)).toBe('en-US');
  });

  it('has exactly the en-US key set in every language file', () => {
    const expected = getTranslationKeys('en-US');
    expect(expected.length).toBeGreaterThan(0);

    for (const code of FORM_LANGUAGE_CODES) {
      expect(translations[code], `missing locale file for ${code}`).toBeDefined();
      expect(getTranslationKeys(code)).toEqual(expected);
    }
  });
});
