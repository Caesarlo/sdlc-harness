import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateAdrCoverage } from '../../src/validators/adr-coverage.js';

test('passes trivially when no topics are required', () => {
  const result = validateAdrCoverage({ requiredAdrTopics: [] }, '/nonexistent');
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('fails when the ADR directory does not exist but topics are required', () => {
  const result = validateAdrCoverage({ requiredAdrTopics: ['data-model'] }, '/nonexistent-dir');
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /ADR directory not found/);
});

test('fails when a required topic has no covering ADR', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, '0001-auth.md'), 'topic: auth\n\n# ADR');
  const result = validateAdrCoverage({ requiredAdrTopics: ['auth', 'data-model'] }, dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /No ADR covers required topic: data-model/);
});

test('passes when every required topic is covered', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, '0001-auth.md'), 'topic: auth\n\n# ADR');
  fs.writeFileSync(path.join(dir, '0002-data-model.md'), 'topic: data-model\n\n# ADR');
  assert.deepEqual(validateAdrCoverage({ requiredAdrTopics: ['auth', 'data-model'] }, dir), { ok: true, errors: [] });
});
