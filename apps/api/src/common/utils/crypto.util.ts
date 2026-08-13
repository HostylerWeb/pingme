import { createHash, randomBytes, randomInt } from 'crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateOtpCode(): string {
  return randomInt(100000, 999999).toString();
}

export function getRequestMeta(request: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}) {
  const forwarded = request.headers['x-forwarded-for'];
  const ip =
    request.ip ||
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined);
  const userAgent =
    typeof request.headers['user-agent'] === 'string'
      ? request.headers['user-agent']
      : undefined;

  return { ipAddress: ip, userAgent };
}
