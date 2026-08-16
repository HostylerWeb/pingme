import type { DistanceConfig } from '@pingme/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { readCachedAppConfig, writeCachedAppConfig } from '../lib/app-config-storage';

const STALE_TIME_MS = 5 * 60 * 1000;

type AppConfigPayload = Awaited<ReturnType<typeof api.getAppConfig>>['data'];

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      try {
        const response = await api.getAppConfig();
        writeCachedAppConfig(response.data);
        return response.data;
      } catch (error) {
        const cached = readCachedAppConfig<AppConfigPayload>();
        if (cached) {
          return cached;
        }
        throw error;
      }
    },
    initialData: () => readCachedAppConfig<AppConfigPayload>() ?? undefined,
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
