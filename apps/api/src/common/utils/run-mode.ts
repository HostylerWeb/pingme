export type RunMode = 'api' | 'worker' | 'all';

export function getRunMode(): RunMode {
  const mode = (process.env.RUN_MODE ?? 'all').toLowerCase();
  if (mode === 'api' || mode === 'worker' || mode === 'all') {
    return mode;
  }
  return 'all';
}

export function shouldRunWorkers(): boolean {
  const mode = getRunMode();
  return mode === 'worker' || mode === 'all';
}

export function shouldRunApi(): boolean {
  const mode = getRunMode();
  return mode === 'api' || mode === 'all';
}
