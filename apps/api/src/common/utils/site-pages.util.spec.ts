import { prefersHtml, isNestRouteNotFoundMessage } from './site-pages.util';

describe('site-pages.util', () => {
  it('prefers HTML when text/html ranks before json', () => {
    expect(
      prefersHtml('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'),
    ).toBe(true);
  });

  it('prefers JSON when application/json is explicit without html', () => {
    expect(prefersHtml('application/json')).toBe(false);
  });

  it('does not treat */* alone as HTML (API clients)', () => {
    expect(prefersHtml('*/*')).toBe(false);
    expect(prefersHtml(undefined)).toBe(false);
  });

  it('detects Nest route-not-found messages', () => {
    expect(isNestRouteNotFoundMessage('Cannot GET /')).toBe(true);
    expect(isNestRouteNotFoundMessage('User not found')).toBe(false);
  });
});
