import { DEFAULT_FORM_LANGUAGE, resolveFormLanguage } from './form-languages';

describe('form-languages', () => {
  it('falls back to en-US for an unknown or missing language', () => {
    expect(resolveFormLanguage('de')).toBe('de');
    expect(resolveFormLanguage('pl')).toBe('pl');
    expect(resolveFormLanguage('en-US')).toBe('en-US');
    expect(resolveFormLanguage('fr-FR')).toBe(DEFAULT_FORM_LANGUAGE);
    expect(resolveFormLanguage(undefined)).toBe('en-US');
    expect(resolveFormLanguage(null)).toBe('en-US');
  });
});
