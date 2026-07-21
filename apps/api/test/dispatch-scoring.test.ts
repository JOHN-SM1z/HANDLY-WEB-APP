import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  requiredTierForComplexity,
  scoreCandidate,
  weightedRandomPick,
} from '../src/modules/dispatch/dispatch-scoring';

test('requiredTierForComplexity matches ARCHITECTURE §9.1 (T0..T3)', () => {
  assert.equal(requiredTierForComplexity('SIMPLE'), 0);
  assert.equal(requiredTierForComplexity('MEDIUM'), 1);
  assert.equal(requiredTierForComplexity('COMPLEX'), 2);
  assert.equal(requiredTierForComplexity('CRITICAL'), 3);
});

test('requiredTierForComplexity defaults to 0 (Simple) when complexity is null', () => {
  assert.equal(requiredTierForComplexity(null), 0);
});

test('scoreCandidate rewards a closer master over a farther one, all else equal', () => {
  const near = scoreCandidate({ distanceM: 500, ratingAvg: 4.5, jobsDone: 50 });
  const far = scoreCandidate({ distanceM: 15_000, ratingAvg: 4.5, jobsDone: 50 });
  assert.ok(near > far, `expected near (${near}) > far (${far})`);
});

test('scoreCandidate rewards a higher rating at equal distance/jobs', () => {
  const good = scoreCandidate({ distanceM: 2000, ratingAvg: 4.9, jobsDone: 20 });
  const meh = scoreCandidate({ distanceM: 2000, ratingAvg: 3.0, jobsDone: 20 });
  assert.ok(good > meh);
});

test('scoreCandidate rewards more completed jobs at equal distance/rating', () => {
  const veteran = scoreCandidate({ distanceM: 2000, ratingAvg: 4.5, jobsDone: 400 });
  const newcomer = scoreCandidate({ distanceM: 2000, ratingAvg: 4.5, jobsDone: 0 });
  assert.ok(veteran > newcomer);
});

test('scoreCandidate stays within a sane 0..1-ish band (weights sum to 1)', () => {
  const best = scoreCandidate({ distanceM: 0, ratingAvg: 5, jobsDone: 1000 });
  const worst = scoreCandidate({ distanceM: 1_000_000, ratingAvg: 0, jobsDone: 0 });
  assert.ok(best <= 1.001);
  assert.ok(worst >= -0.001);
});

test('weightedRandomPick always returns a candidate from the input list', () => {
  const candidates = [{ id: 'a', w: 1 }, { id: 'b', w: 5 }, { id: 'c', w: 0.1 }];
  for (let i = 0; i < 50; i++) {
    const picked = weightedRandomPick(candidates, (c) => c.w);
    assert.ok(candidates.some((c) => c.id === picked.id));
  }
});

test('weightedRandomPick heavily favors a much higher weight over many draws', () => {
  const candidates = [{ id: 'closest', w: 100 }, { id: 'farthest', w: 0.01 }];
  let closestWins = 0;
  const N = 500;
  for (let i = 0; i < N; i++) {
    if (weightedRandomPick(candidates, (c) => c.w).id === 'closest') closestWins++;
  }
  // Not deterministic by design (§9.2.3 weighted-random) — just assert it's
  // overwhelmingly more likely, not that it always wins.
  assert.ok(closestWins > N * 0.9, `expected >90% closest wins, got ${closestWins}/${N}`);
});

test('weightedRandomPick throws on an empty candidate list rather than picking undefined', () => {
  assert.throws(() => weightedRandomPick([], () => 1));
});

test('weightedRandomPick tolerates a zero-weight candidate without ever throwing', () => {
  const candidates = [{ id: 'a', w: 0 }, { id: 'b', w: 0 }];
  for (let i = 0; i < 10; i++) {
    assert.doesNotThrow(() => weightedRandomPick(candidates, (c) => c.w));
  }
});
