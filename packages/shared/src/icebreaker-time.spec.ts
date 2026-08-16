import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatIcebreakerTimeRemaining } from './distance-config';

describe('formatIcebreakerTimeRemaining', () => {
  const now = Date.parse('2026-08-17T12:00:00.000Z');

  it('shows exactly one hour at session start', () => {
    const expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
    assert.equal(formatIcebreakerTimeRemaining(expiresAt, now), '1 hour left');
  });

  it('does not round a 60-minute window up to 1h 1m', () => {
    const expiresAt = new Date(now + 60 * 60 * 1000 + 45_000).toISOString();
    assert.equal(formatIcebreakerTimeRemaining(expiresAt, now), '1 hour left');
  });

  it('shows 1h 1m only when a full extra minute remains', () => {
    const expiresAt = new Date(now + 61 * 60 * 1000).toISOString();
    assert.equal(formatIcebreakerTimeRemaining(expiresAt, now), '1h 1m left');
  });

  it('floors sub-minute remainder for short windows', () => {
    const expiresAt = new Date(now + 59 * 60 * 1000 + 59_000).toISOString();
    assert.equal(formatIcebreakerTimeRemaining(expiresAt, now), '59 min left');
  });

  it('returns ending soon at or past expiry', () => {
    assert.equal(formatIcebreakerTimeRemaining(new Date(now).toISOString(), now), 'Ending soon');
    assert.equal(
      formatIcebreakerTimeRemaining(new Date(now - 1).toISOString(), now),
      'Ending soon',
    );
  });
});
