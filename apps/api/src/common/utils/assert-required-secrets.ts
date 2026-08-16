import { ConfigService } from '@nestjs/config';

const WEAK_SECRETS = new Set([
  'dev-secret',
  'dev-admin-secret',
  'change-me',
  'change-me-in-production',
]);

function isWeakSecret(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  const normalized = value.trim().toLowerCase();
  if (WEAK_SECRETS.has(normalized)) return true;
  if (normalized.startsWith('change-me')) return true;
  return false;
}

/** Refuse to boot in production with missing or placeholder JWT secrets. */
export function assertRequiredSecrets(config: ConfigService, nodeEnv: string) {
  if (nodeEnv !== 'production') return;

  const access = config.get<string>('JWT_ACCESS_SECRET');
  const admin = config.get<string>('JWT_ADMIN_SECRET');

  if (isWeakSecret(access)) {
    throw new Error(
      'Refusing to start: JWT_ACCESS_SECRET is missing or uses a weak/default value in production',
    );
  }
  if (isWeakSecret(admin)) {
    throw new Error(
      'Refusing to start: JWT_ADMIN_SECRET is missing or uses a weak/default value in production',
    );
  }
}
