import { FormSchema } from '../schemas/form.schema';
import { DEFAULT_FORM_LANGUAGE, FORM_LANGUAGE_CODES, resolveFormLanguage } from './form-languages';

describe('form-languages', () => {
  it('falls back to en-US for an unknown or missing language', () => {
    expect(resolveFormLanguage('de')).toBe('de');
    expect(resolveFormLanguage('pl')).toBe('pl');
    expect(resolveFormLanguage('en-US')).toBe('en-US');
    expect(resolveFormLanguage('fr-FR')).toBe(DEFAULT_FORM_LANGUAGE);
    expect(resolveFormLanguage(undefined)).toBe('en-US');
    expect(resolveFormLanguage(null)).toBe('en-US');
  });

  it('declares language as a mongoose enum of supported locales', () => {
    const languagePath = FormSchema.path('language');
    expect(languagePath.options.enum).toEqual([...FORM_LANGUAGE_CODES]);
    expect(languagePath.options.default).toBe('en-US');
  });
});
