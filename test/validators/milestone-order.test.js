import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMilestoneOrder } from '../../src/validators/milestone-order.js';

const milestones = [{ id: 'M0' }, { id: 'M1' }];

test('accepts a feature depending on an earlier milestone', () => {
  const data = {
    milestones,
    features: [
      { id: 'A', milestone: 'M0', dependencies: [] },
      { id: 'B', milestone: 'M1', dependencies: ['A'] },
    ],
  };
  assert.deepEqual(validateMilestoneOrder(data), { ok: true, errors: [] });
});

test('rejects a feature depending on a later milestone', () => {
  const data = {
    milestones,
    features: [
      { id: 'A', milestone: 'M0', dependencies: ['B'] },
      { id: 'B', milestone: 'M1', dependencies: [] },
    ],
  };
  const result = validateMilestoneOrder(data);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /comes later/);
});
