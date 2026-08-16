import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getProfileCompleteness } from './profile-completeness';

describe('getProfileCompleteness', () => {
  it('returns 0% when profile is empty', () => {
    const result = getProfileCompleteness({});
    assert.equal(result.percent, 0);
    assert.equal(result.isComplete, false);
    assert.equal(result.nextItem?.id, 'photo');
  });

  it('counts contact complete when email or phone is verified', () => {
    const emailOnly = getProfileCompleteness({
      avatarUrl: 'https://example.com/a.jpg',
      bio: 'Hello',
      gender: 'woman',
      livenessVerified: true,
      emailVerified: true,
      phoneVerified: false,
    });
    assert.equal(emailOnly.percent, 100);
    assert.equal(emailOnly.isComplete, true);

    const phoneOnly = getProfileCompleteness({
      avatarUrl: 'https://example.com/a.jpg',
      bio: 'Hello',
      gender: 'man',
      livenessVerified: true,
      emailVerified: false,
      phoneVerified: true,
    });
    assert.equal(phoneOnly.isComplete, true);
  });

  it('suggests the first incomplete step as nextItem', () => {
    const result = getProfileCompleteness({
      avatarUrl: 'https://example.com/a.jpg',
      bio: '   ',
      gender: 'non_binary',
      livenessVerified: false,
      emailVerified: false,
      phoneVerified: false,
    });
    assert.equal(result.percent, 40);
    assert.equal(result.nextItem?.id, 'bio');
  });
});
