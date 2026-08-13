import { createHmac, timingSafeEqual } from 'node:crypto';

export function shortenFloats<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map((item) => shortenFloats(item)) as T;
  }
  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = shortenFloats(value);
    }
    return result as T;
  }
  if (typeof data === 'number' && Number.isFinite(data) && Math.floor(data) === data) {
    return data as T;
  }
  return data;
}

export function sortKeysRecursive<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map((item) => sortKeysRecursive(item)) as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(data as Record<string, unknown>).sort()) {
    sorted[key] = sortKeysRecursive((data as Record<string, unknown>)[key]);
  }
  return sorted as T;
}

export function verifyDiditSignatureV2(
  body: Record<string, unknown>,
  signature: string,
  timestamp: string,
  secret: string,
): boolean {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return false;
  }

  const canonical = JSON.stringify(sortKeysRecursive(shortenFloats(body)));
  const expected = createHmac('sha256', secret).update(canonical).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function verifyDiditSignatureSimple(
  body: Record<string, unknown>,
  signature: string,
  timestamp: string,
  secret: string,
): boolean {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return false;
  }

  const canonical = [
    body.timestamp ?? '',
    body.session_id ?? '',
    body.status ?? '',
    body.webhook_type ?? '',
  ].join(':');

  const expected = createHmac('sha256', secret).update(canonical).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
