import { clearTokens } from './auth-storage';

type AuthFailureHandler = () => void | Promise<void>;

let handler: AuthFailureHandler | null = null;
let handling = false;

export function registerAuthFailureHandler(fn: AuthFailureHandler) {
  handler = fn;
}

export async function handleAuthFailure() {
  if (handling) return;
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
