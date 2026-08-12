import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePassGate } from '../../src/validators/pass-gate.js';

function feature(overrides = {}) {
  return { id: 'M0-FEAT-001', status: 'not_started', evidence: [], ...overrides };
}

test('accepts zero or one in_progress feature', () => {
  const data = { features: [feature({ status: 'in_progress' })] };
  assert.deepEqual(validatePassGate(data, null), { ok: true, errors: [] });
});

test('rejects more than one in_progress feature', () => {
  const data = { features: [
    feature({ id: 'A', status: 'in_progress' }),
    feature({ id: 'B', status: 'in_progress' }),
  ] };
  const result = validatePassGate(data, null);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Only one feature may be in_progress/);
});

test('rejects a passing feature with no evidence', () => {
  const data = { features: [feature({ status: 'passing', evidence: [] })] };
  const result = validatePassGate(data, null);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /no evidence/);
});

test('rejects a passing feature with evidence but no review entry', () => {
  const data = { features: [feature({ status: 'passing', evidence: [{ kind: 'test-run' }] })] };
  const result = validatePassGate(data, null);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /no evidence entry with kind "review"/);
});

test('accepts a passing feature with review evidence', () => {
  const data = { features: [feature({ status: 'passing', evidence: [{ kind: 'test-run' }, { kind: 'review' }] })] };
  assert.deepEqual(validatePassGate(data, null), { ok: true, errors: [] });
});

test('rejects a SCOPE placeholder marked passing', () => {
  const data = { features: [feature({ id: 'M2-SCOPE-001', status: 'passing', evidence: [{ kind: 'review' }] })] };
  const result = validatePassGate(data, null);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must never be marked passing/);
});

test('rejects a regression against the previous snapshot (passing_is_monotonic)', () => {
  const previousSnapshot = { features: [feature({ status: 'passing', evidence: [{ kind: 'review' }] })] };
  const data = { features: [feature({ status: 'blocked' })] };
  const result = validatePassGate(data, previousSnapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /passing_is_monotonic/);
});
