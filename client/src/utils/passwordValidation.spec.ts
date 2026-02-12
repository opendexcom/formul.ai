import { describe, it, expect } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
  getPasswordRuleChecks,
  validatePassword,
  getPasswordStrength,
} from './passwordValidation';

describe('passwordValidation', () => {
  describe('PASSWORD_MIN_LENGTH', () => {
    it('is 8', () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8);
    });
  });

  describe('PASSWORD_REQUIREMENTS_MESSAGE', () => {
    it('describes uppercase, lowercase, number, special character and min length', () => {
      expect(PASSWORD_REQUIREMENTS_MESSAGE).toContain('8 characters');
      expect(PASSWORD_REQUIREMENTS_MESSAGE).toContain('uppercase');
      expect(PASSWORD_REQUIREMENTS_MESSAGE).toContain('lowercase');
      expect(PASSWORD_REQUIREMENTS_MESSAGE).toContain('number');
      expect(PASSWORD_REQUIREMENTS_MESSAGE).toContain('special character');
    });
  });

  describe('getPasswordRuleChecks', () => {
    it('returns all rules unmet for empty string', () => {
      const checks = getPasswordRuleChecks('');
      expect(checks).toHaveLength(5);
      expect(checks.every((c) => !c.met)).toBe(true);
      expect(checks.map((c) => c.label)).toContain('At least 8 characters');
      expect(checks.map((c) => c.label)).toContain('One uppercase letter');
      expect(checks.map((c) => c.label)).toContain('One lowercase letter');
      expect(checks.map((c) => c.label)).toContain('One number');
      expect(checks.map((c) => c.label)).toContain('One special character (!@#$%^&* etc.)');
    });

    it('marks length met when 8+ chars', () => {
      const checks = getPasswordRuleChecks('abcdefgh');
      expect(checks[0].label).toBe('At least 8 characters');
      expect(checks[0].met).toBe(true);
    });

    it('marks uppercase met when A-Z present', () => {
      const checks = getPasswordRuleChecks('A');
      expect(checks.find((c) => c.label === 'One uppercase letter')?.met).toBe(true);
    });

    it('marks lowercase met when a-z present', () => {
      const checks = getPasswordRuleChecks('a');
      expect(checks.find((c) => c.label === 'One lowercase letter')?.met).toBe(true);
    });

    it('marks number met when digit present', () => {
      const checks = getPasswordRuleChecks('1');
      expect(checks.find((c) => c.label === 'One number')?.met).toBe(true);
    });

    it('marks special met when special char present', () => {
      const checks = getPasswordRuleChecks('!');
      expect(checks.find((c) => c.label === 'One special character (!@#$%^&* etc.)')?.met).toBe(true);
    });

    it('returns all met for valid strong password', () => {
      const checks = getPasswordRuleChecks('SecureP@ss1');
      expect(checks.every((c) => c.met)).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('returns invalid and errors for empty string', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('At least 8 characters');
    });

    it('returns invalid for password with only length 6', () => {
      const result = validatePassword('abcdef');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('One uppercase letter');
      expect(result.errors).toContain('One number');
      expect(result.errors).toContain('One special character (!@#$%^&* etc.)');
    });

    it('returns invalid when missing uppercase', () => {
      const result = validatePassword('securep@ss1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('One uppercase letter');
    });

    it('returns invalid when missing lowercase', () => {
      const result = validatePassword('SECUREP@SS1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('One lowercase letter');
    });

    it('returns invalid when missing digit', () => {
      const result = validatePassword('SecureP@ss');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('One number');
    });

    it('returns invalid when missing special character', () => {
      const result = validatePassword('SecurePass1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('One special character (!@#$%^&* etc.)');
    });

    it('returns valid for password meeting all rules', () => {
      const result = validatePassword('SecureP@ss1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for another strong password', () => {
      expect(validatePassword('MyP@ssw0rd').valid).toBe(true);
      expect(validatePassword('Ab1!xxxx').valid).toBe(true);
    });
  });

  describe('getPasswordStrength', () => {
    it('returns weak for empty or few rules met', () => {
      expect(getPasswordStrength('')).toBe('weak');
      expect(getPasswordStrength('ab')).toBe('weak');
      expect(getPasswordStrength('abcdefgh')).toBe('weak');
    });

    it('returns fair when 3 or 4 rules met', () => {
      expect(getPasswordStrength('Abcdefgh')).toBe('fair'); // length, upper, lower
      expect(getPasswordStrength('Abcdefg1')).toBe('fair');
      expect(getPasswordStrength('Abcdefg!')).toBe('fair');
    });

    it('returns strong only when all 5 rules met', () => {
      expect(getPasswordStrength('SecureP@ss1')).toBe('strong');
      expect(getPasswordStrength('MyP@ssw0rd')).toBe('strong');
    });
  });
});
