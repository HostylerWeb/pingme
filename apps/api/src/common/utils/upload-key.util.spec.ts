import { assertSafeAvatarObjectKey, assertSafeEventObjectKey } from './upload-key.util';

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

describe('assertSafeEventObjectKey', () => {
  const eventId = 'event-456';

  it('accepts a normal event image key', () => {
    expect(assertSafeEventObjectKey(eventId, 'events/event-456/123-photo.jpg')).toBe(
      'events/event-456/123-photo.jpg',
    );
  });

  it('rejects keys for another event', () => {
    expect(() =>
      assertSafeEventObjectKey(eventId, 'events/other-event/photo.jpg'),
    ).toThrow('Invalid upload key');
  });

  it('rejects path traversal with ..', () => {
    expect(() =>
      assertSafeEventObjectKey(eventId, 'events/event-456/../../../.env'),
    ).toThrow('Invalid upload key');
  });
});
