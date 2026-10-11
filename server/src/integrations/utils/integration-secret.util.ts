import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function generateInboundSecret(): string {
  return randomBytes(32).toString('hex');
}

export function hashInboundSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function verifyInboundSecret(provided: string, storedHash: string): boolean {
  if (!provided || !storedHash) {
    return false;
  }
  const providedHash = hashInboundSecret(provided);
  try {
    return timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  } catch {
    return false;
  }
}

export function extractSecretFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
}): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const headerSecret = req.headers['x-formulai-secret'];
  if (typeof headerSecret === 'string' && headerSecret.trim()) {
    return headerSecret.trim();
  }

  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  return null;
}
