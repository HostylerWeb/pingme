import type { DistanceConfig } from '@pingme/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      const response = await api.getAppConfig();
      return response.data;
    },
    staleTime: STALE_TIME_MS,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

export function useDistanceConfig(): DistanceConfig | undefined {
  return useAppConfig().data?.distance;
}

export function useRequiredDistanceConfig(): DistanceConfig {
  const distance = useDistanceConfig();
  if (!distance) {
    throw new Error('Distance config is not loaded');
  }
  return distance;
}
