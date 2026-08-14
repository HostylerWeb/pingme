import { createCorsOriginDelegate, parseCorsOrigins } from './cors.util';

describe('cors.util', () => {
  it('parses comma-separated origins', () => {
    expect(parseCorsOrigins('https://a.test, https://b.test', 'production')).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
  });

  it('allows missing origin for mobile clients', (done) => {
    const delegate = createCorsOriginDelegate(['https://admin.test'], 'production');
    delegate(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('allows configured browser origins', (done) => {
    const delegate = createCorsOriginDelegate(['https://admin.test'], 'production');
    delegate('https://admin.test', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('rejects unknown origins in production', (done) => {
    const delegate = createCorsOriginDelegate(['https://admin.test'], 'production');
    delegate('https://evil.test', (err, allow) => {
      expect(err).toBeInstanceOf(Error);
      expect(allow).toBe(false);
      done();
    });
  });

  it('allows any origin in non-production when list is empty', (done) => {
    const delegate = createCorsOriginDelegate([], 'development');
    delegate('http://localhost:3004', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });
});
