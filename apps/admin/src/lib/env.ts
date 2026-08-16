import { API_BASE_URL } from './api';

export type AppEnv = 'local' | 'staging' | 'production';

export function getAppEnv(): AppEnv {
  const configured = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (configured === 'local' || configured === 'staging' || configured === 'production') {
    return configured;
  }

  const api = API_BASE_URL.toLowerCase();
  if (api.includes('localhost') || api.includes('127.0.0.1')) {
    return 'local';
  }
  if (api.includes('hostyler.cloud') || api.includes('staging')) {
    return 'staging';
  }

  return 'production';
}
