import { existsSync } from 'fs';
import { join } from 'path';

/** Resolve apps/api/public/site across monorepo cwd and compiled dist layouts. */
export function resolveSiteDir(): string | null {
  const candidates = [
    join(process.cwd(), 'apps/api/public/site'),
    join(process.cwd(), 'public/site'),
    join(__dirname, '..', '..', '..', 'public', 'site'),
    join(__dirname, '..', '..', 'public', 'site'),
  ];

  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) {
      return dir;
    }
  }

  return null;
}

export function prefersHtml(acceptHeader: string | undefined): boolean {
  const accept = (acceptHeader ?? '').toLowerCase();
  if (!accept || accept === '*/*') {
    return false;
  }
  const htmlIdx = accept.indexOf('text/html');
  if (htmlIdx === -1) {
    return false;
  }
  const jsonIdx = accept.indexOf('application/json');
  if (jsonIdx === -1) {
    return true;
  }
  return htmlIdx < jsonIdx;
}

export function isNestRouteNotFoundMessage(message: string): boolean {
  return /^Cannot (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) /i.test(message);
}
