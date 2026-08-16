/**
 * Parse comma-separated CORS origins. Empty in production falls back to deny-by-default
 * unless NODE_ENV is not production (then reflects any origin for local dev).
 */
export function parseCorsOrigins(raw: string | undefined, nodeEnv: string): string[] {
  if (raw?.trim()) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (nodeEnv !== 'production') {
    return [];
  }

  return [];
}

export function createCorsOriginDelegate(allowedOrigins: string[], nodeEnv: string) {
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // React Native / server-side clients often omit Origin.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0 && nodeEnv !== 'production') {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // Reject without throwing — an Error here makes OPTIONS preflight return 500.
    callback(null, false);
  };
}
