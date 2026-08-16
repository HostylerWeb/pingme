'use client';

import { envBannerLabel, getAppEnv } from '@/lib/env';

export function EnvBanner() {
  const env = getAppEnv();
  const label = envBannerLabel(env);

  if (!label) {
    return null;
  }

  const styles =
    env === 'staging'
      ? 'bg-amber-500/15 text-amber-950 border-amber-500/30 dark:text-amber-100'
      : 'bg-sky-500/15 text-sky-950 border-sky-500/30 dark:text-sky-100';

  return (
    <div
      role="status"
      className={`shrink-0 border-b px-4 py-2 text-center text-sm font-medium ${styles}`}
    >
      {label} — changes here are not production
    </div>
  );
}
