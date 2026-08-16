import { BadRequestException } from '@nestjs/common';
import { basename, posix as pathPosix } from 'path';

const SAFE_BASENAME = /^[A-Za-z0-9._-]+$/;

/**
 * Validates an avatar object key so it cannot escape avatars/<userId>/.
 * Returns the normalized posix key.
 */
export function assertSafeAvatarObjectKey(userId: string, key: string): string {
  if (!userId || typeof userId !== 'string') {
    throw new BadRequestException('Invalid upload key');
  }
  if (!key || typeof key !== 'string') {
    throw new BadRequestException('Invalid upload key');
  }
  if (key.includes('\0')) {
    throw new BadRequestException('Invalid upload key');
  }
  if (key.startsWith('/') || /^[A-Za-z]:[\\/]/.test(key)) {
    throw new BadRequestException('Invalid upload key');
  }
  if (key.split(/[/\\]/).some((segment) => segment === '..')) {
    throw new BadRequestException('Invalid upload key');
  }

  const normalized = pathPosix.normalize(key.replace(/\\/g, '/'));
  if (normalized !== key.replace(/\\/g, '/') && normalized.includes('..')) {
    throw new BadRequestException('Invalid upload key');
  }
  if (normalized.startsWith('..') || normalized.includes('/../')) {
    throw new BadRequestException('Invalid upload key');
  }

  const prefix = `avatars/${userId}/`;
  if (!normalized.startsWith(prefix)) {
    throw new BadRequestException('Invalid upload key');
  }

  const rest = normalized.slice(prefix.length);
  if (!rest || rest.includes('/') || rest.includes('\\')) {
    throw new BadRequestException('Invalid upload key');
  }
  if (!SAFE_BASENAME.test(basename(rest))) {
    throw new BadRequestException('Invalid upload key');
  }

  return normalized;
}
