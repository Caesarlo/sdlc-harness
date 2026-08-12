import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDependencyCycles } from '../../src/validators/dependency-cycles.js';

function feature(id, dependencies = []) {
  return { id, dependencies };
}

test('accepts an acyclic dependency graph', () => {
  const data = { features: [feature('A'), feature('B', ['A']), feature('C', ['B'])] };
  assert.deepEqual(validateDependencyCycles(data), { ok: true, errors: [] });
});

test('rejects a direct cycle', () => {
  const data = { features: [feature('A', ['B']), feature('B', ['A'])] };
  const result = validateDependencyCycles(data);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Dependency cycle/);
});

test('rejects a dependency on an unknown feature', () => {
  const data = { features: [feature('A', ['GHOST'])] };
  const result = validateDependencyCycles(data);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unknown feature: GHOST/);
});
