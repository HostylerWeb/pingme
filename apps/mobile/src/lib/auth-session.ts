import { clearTokens } from './auth-storage';

type AuthFailureHandler = () => void | Promise<void>;

let handler: AuthFailureHandler | null = null;
let handling = false;
let signOutInProgress = false;
let authSessionEpoch = 0;

export function getAuthSessionEpoch() {
  return authSessionEpoch;
}

export function bumpAuthSessionEpoch() {
  authSessionEpoch += 1;
}

export function setSignOutInProgress(value: boolean) {
  signOutInProgress = value;
}

export function isSignOutInProgress() {
  return signOutInProgress;
}

export function isStaleAuthSession(epochAtStart: number) {
  return epochAtStart !== authSessionEpoch;
}

export function registerAuthFailureHandler(fn: AuthFailureHandler) {
  handler = fn;
}

export async function handleAuthFailure(epochAtStart?: number) {
  if (handling || signOutInProgress) return;
  if (epochAtStart !== undefined && isStaleAuthSession(epochAtStart)) return;

  handling = true;
  try {
    await clearTokens();
    if (handler) {
      await handler();
    }
  } finally {
    handling = false;
  }
}
