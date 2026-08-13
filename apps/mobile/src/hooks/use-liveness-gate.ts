import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

export function useLivenessGate() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const ensureVerified = useCallback(() => {
    if (user?.livenessVerified !== false) {
      return true;
    }
    router.push('/(setup)/liveness');
    return false;
  }, [user?.livenessVerified, router]);

  const handleLivenessError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === 'LIVENESS_REQUIRED') {
        router.push('/(setup)/liveness');
        return true;
      }
      return false;
    },
    [router],
  );

  return {
    ensureVerified,
    handleLivenessError,
    isVerified: user?.livenessVerified !== false,
  };
}
