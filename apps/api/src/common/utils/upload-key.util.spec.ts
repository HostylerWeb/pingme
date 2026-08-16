import { assertSafeAvatarObjectKey } from './upload-key.util';

describe('assertSafeAvatarObjectKey', () => {
  const userId = 'user-123';

  it('accepts a normal avatar key', () => {
    expect(assertSafeAvatarObjectKey(userId, 'avatars/user-123/123-photo.jpg')).toBe(
      'avatars/user-123/123-photo.jpg',
    );
  });

  it('rejects path traversal with ..', () => {
    expect(() =>
      assertSafeAvatarObjectKey(userId, 'avatars/user-123/../../../.env'),
    ).toThrow('Invalid upload key');
  });

  it('rejects absolute paths', () => {
    expect(() => assertSafeAvatarObjectKey(userId, '/etc/passwd')).toThrow('Invalid upload key');
  });

  it('rejects keys for another user', () => {
    expect(() =>
      assertSafeAvatarObjectKey(userId, 'avatars/other-user/photo.jpg'),
    ).toThrow('Invalid upload key');
  });

  it('rejects nested directories under the user prefix', () => {
    expect(() =>
      assertSafeAvatarObjectKey(userId, 'avatars/user-123/nested/photo.jpg'),
    ).toThrow('Invalid upload key');
  });

  it('rejects null bytes', () => {
    expect(() =>
      assertSafeAvatarObjectKey(userId, 'avatars/user-123/photo.jpg\0.txt'),
    ).toThrow('Invalid upload key');
  });
});
