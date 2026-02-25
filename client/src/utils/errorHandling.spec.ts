import { describe, it, expect } from 'vitest';
import { getErrorMessage, isAxiosError, isNetworkError } from './errorHandling';

function createAxiosError(data: { message?: string | string[]; error?: string }) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status: 400, data },
  }) as import('axios').AxiosError<typeof data>;
}

describe('errorHandling', () => {
  describe('getErrorMessage', () => {
    it('returns normalized string when NestJS sends message as array (400 validation)', () => {
      const validationMessage =
        'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character.';
      const fakeError = createAxiosError({ message: [validationMessage], error: 'Bad Request' });
      // normalizeMessage strips trailing periods consistently for single and multi-element arrays
      expect(getErrorMessage(fakeError)).toBe(validationMessage.replace(/\.+$/, ''));
    });

    it('joins multiple validation messages with ". "', () => {
      const fakeError = createAxiosError({
        message: ['Password must be at least 8 characters.', 'email must be an email'],
        error: 'Bad Request',
      });
      expect(getErrorMessage(fakeError)).toBe(
        'Password must be at least 8 characters. email must be an email',
      );
    });

    it('strips trailing period from single-element array (consistent with multi-element)', () => {
      const fakeError = createAxiosError({ message: ['Validation failed.'] });
      expect(getErrorMessage(fakeError)).toBe('Validation failed');
    });

    it('returns message as-is when backend sends string message', () => {
      const fakeError = createAxiosError({ message: 'Single error message', error: 'Bad Request' });
      expect(getErrorMessage(fakeError)).toBe('Single error message');
    });

    it('returns Error message for non-axios Error', () => {
      expect(getErrorMessage(new Error('Something went wrong'))).toBe('Something went wrong');
    });

    it('returns string when error is string', () => {
      expect(getErrorMessage('fail')).toBe('fail');
    });

    it('returns generic message for unknown error', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
    });
  });

  describe('isAxiosError', () => {
    it('returns true for object with isAxiosError flag', () => {
      const fakeAxiosError = createAxiosError({ message: 'Bad Request' });
      expect(isAxiosError(fakeAxiosError)).toBe(true);
    });

    it('returns false for plain Error', () => {
      expect(isAxiosError(new Error('x'))).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('returns false for non-axios error', () => {
      expect(isNetworkError(new Error('x'))).toBe(false);
    });
  });
});
