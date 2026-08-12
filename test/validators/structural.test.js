import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStructural } from '../../src/validators/structural.js';

function baseData(overrides = {}) {
  return {
    project: 'demo',
    schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features: [{
      id: 'M0-FEAT-001',
      milestone: 'M0',
      behavior: 'does a thing',
      status: 'not_started',
      dependencies: [],
      verification: [{ type: 'automated', command: 'test', expected: 'pass' }],
    }],
    ...overrides,
  };
}

test('accepts a well-formed feature list', () => {
  const result = validateStructural(baseData());
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('rejects a feature with an invalid status', () => {
  const data = baseData();
  data.features[0].status = 'done';
  const result = validateStructural(data);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /invalid status/);
});

test('rejects a feature referencing an unknown milestone', () => {
  const data = baseData();
  data.features[0].milestone = 'M9';
  const result = validateStructural(data);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /unknown milestone/);
});

test('rejects duplicate feature ids', () => {
  const data = baseData();
  data.features.push({ ...data.features[0] });
  const result = validateStructural(data);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Duplicate feature id/);
});

test('rejects a feature with no verification entries', () => {
  const data = baseData();
  data.features[0].verification = [];
  const result = validateStructural(data);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /at least one verification entry/);
});
