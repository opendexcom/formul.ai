/**
 * Password validation utility – mirrors backend policy (min 8 chars, uppercase, lowercase, digit, special).
 * Used for client-side validation and password strength indicator.
 */

export const PASSWORD_MIN_LENGTH = 8;

const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export interface PasswordRuleCheck {
  label: string;
  met: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type PasswordStrength = 'weak' | 'fair' | 'strong';

/**
 * Returns which rules are met for the given password (for checkmarks / strength).
 */
export function getPasswordRuleChecks(password: string): PasswordRuleCheck[] {
  return [
    { label: 'At least 8 characters', met: password.length >= PASSWORD_MIN_LENGTH },
    { label: 'One uppercase letter', met: HAS_UPPERCASE.test(password) },
    { label: 'One lowercase letter', met: HAS_LOWERCASE.test(password) },
    { label: 'One number', met: HAS_DIGIT.test(password) },
    { label: 'One special character (!@#$%^&* etc.)', met: HAS_SPECIAL.test(password) },
  ];
}

/**
 * Validates password against backend policy. Use before submit.
 */
export function validatePassword(password: string): ValidationResult {
  const checks = getPasswordRuleChecks(password);
  const errors = checks.filter((c) => !c.met).map((c) => c.label);
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Computes strength from 0–3 (number of character-type rules met, excluding length for granularity)
 * or use getPasswordStrengthLabel for "weak" | "fair" | "strong".
 * All 5 rules (length + 4 types) must be considered for "strong".
 */
function countRulesMet(password: string): number {
  return getPasswordRuleChecks(password).filter((c) => c.met).length;
}

/**
 * Returns strength label for the indicator. Strong only when all rules are met.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  const met = countRulesMet(password);
  if (met === 5) return 'strong';
  if (met >= 3) return 'fair';
  return 'weak';
}

/**
 * Single user-facing message listing requirements (for API-style error or helper text).
 */
export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character.';
