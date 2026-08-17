import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReputationSummary,
  getReputationTier,
  pointsToNextTier,
  REPUTATION_SCORE_MAX,
} from './reputation';

describe('reputation', () => {
  it('maps score to tier thresholds', () => {
    assert.equal(getReputationTier(0), 'new');
    assert.equal(getReputationTier(199), 'new');
    assert.equal(getReputationTier(200), 'regular');
    assert.equal(getReputationTier(449), 'regular');
    assert.equal(getReputationTier(450), 'respected');
    assert.equal(getReputationTier(699), 'respected');
    assert.equal(getReputationTier(700), 'trusted');
    assert.equal(getReputationTier(999), 'trusted');
    assert.equal(getReputationTier(1000), 'master');
    assert.equal(getReputationTier(REPUTATION_SCORE_MAX), 'master');
  });

  it('computes points to next tier', () => {
    assert.equal(pointsToNextTier(0), 200);
    assert.equal(pointsToNextTier(150), 50);
    assert.equal(pointsToNextTier(1000), REPUTATION_SCORE_MAX - 1000);
  });

  it('builds summary for profile', () => {
    const summary = buildReputationSummary(150);
    assert.equal(summary.tier, 'new');
    assert.equal(summary.tierLabel, 'New');
    assert.equal(summary.pointsToNextTier, 50);
    assert.equal(summary.nextTier, 'regular');
  });
});
