import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDependencyReadiness } from '../../src/validators/dependency-readiness.js';

test('accepts an in_progress feature whose dependencies are all passing', () => {
  const data = {
    features: [
      { id: 'M0-FEAT-001', status: 'passing', dependencies: [] },
      { id: 'M0-FEAT-002', status: 'in_progress', dependencies: ['M0-FEAT-001'] },
    ],
  };
  assert.deepEqual(validateDependencyReadiness(data), { ok: true, errors: [] });
});

test('rejects an in_progress feature depending on a not-yet-passing feature', () => {
  const data = {
    features: [
      { id: 'M0-FEAT-001', status: 'not_started', dependencies: [] },
      { id: 'M0-FEAT-002', status: 'in_progress', dependencies: ['M0-FEAT-001'] },
    ],
  };
  const result = validateDependencyReadiness(data);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /M0-FEAT-002 is in_progress but depends on M0-FEAT-001, which is not passing/);
});

test('ignores dependencies that do not resolve to a known feature', () => {
  const data = {
    features: [{ id: 'M0-FEAT-001', status: 'in_progress', dependencies: ['M0-FEAT-999'] }],
  };
  assert.deepEqual(validateDependencyReadiness(data), { ok: true, errors: [] });
});

test('ignores features that are not in_progress', () => {
  const data = {
    features: [
      { id: 'M0-FEAT-001', status: 'not_started', dependencies: [] },
      { id: 'M0-FEAT-002', status: 'blocked', dependencies: ['M0-FEAT-001'] },
    ],
  };
  assert.deepEqual(validateDependencyReadiness(data), { ok: true, errors: [] });
});
