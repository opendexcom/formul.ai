import { describe, expect, it } from 'vitest';
import { isAuthCredentialRequest } from './apiClient';

describe('isAuthCredentialRequest', () => {
  it('matches login and other credential endpoints', () => {
    expect(isAuthCredentialRequest('/auth/login')).toBe(true);
    expect(isAuthCredentialRequest('http://localhost:3001/api/auth/login')).toBe(true);
    expect(isAuthCredentialRequest('/auth/register')).toBe(true);
    expect(isAuthCredentialRequest('/auth/forgot-password')).toBe(true);
  });

  it('does not match protected API calls', () => {
    expect(isAuthCredentialRequest('/forms')).toBe(false);
    expect(isAuthCredentialRequest('/users/me')).toBe(false);
    expect(isAuthCredentialRequest(undefined)).toBe(false);
  });
});
