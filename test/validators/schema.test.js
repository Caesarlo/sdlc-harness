import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateSchema } from '../../src/validators/schema.js';

function validData() {
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
      verification: [{ type: 'automated', command: 'npm test', expected: 'exit 0' }],
    }],
  };
}

test('accepts a well-formed feature list against the bundled schema', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  assert.deepEqual(validateSchema(validData(), dir), { ok: true, errors: [] });
});

test('rejects a feature with the wrong type for dependencies (schema catches type errors structural.js does not)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const data = validData();
  data.features[0].dependencies = 'not-an-array';
  const result = validateSchema(data, dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /dependencies/);
});

test('rejects an invalid status enum value', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const data = validData();
  data.features[0].status = 'done';
  const result = validateSchema(data, dir);
  assert.equal(result.ok, false);
});

test('prefers a repo-local feature_list.schema.json over the bundled one when present', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const strictSchema = {
    type: 'object',
    required: ['project', 'schema_version', 'milestones', 'features', 'customRequiredField'],
  };
  fs.writeFileSync(path.join(dir, 'feature_list.schema.json'), JSON.stringify(strictSchema));

  const result = validateSchema(validData(), dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /customRequiredField/);
});
