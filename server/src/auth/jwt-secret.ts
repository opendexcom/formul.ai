export const INSECURE_JWT_SECRET_DEFAULT = 'your-secret-key';

export const JWT_SECRET_ERROR =
  'JWT_SECRET is required and must not be empty or the insecure default "your-secret-key". Set JWT_SECRET in the environment (see server/.env.example).';

/**
 * Single accessor for the signing secret. Callers must not fall back to a
 * hardcoded default — a missing or known-insecure value is a startup failure.
 */
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(JWT_SECRET_ERROR);
  }
  if (secret.trim() === INSECURE_JWT_SECRET_DEFAULT) {
    throw new Error(JWT_SECRET_ERROR);
  }
  return secret;
}
