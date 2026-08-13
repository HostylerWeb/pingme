import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
  });
  initialized = true;
}

export { Sentry };
