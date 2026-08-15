import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return false;
  }
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
    mutations: {
      retry: false,
    },
  },
});
