import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runValidate } from '../../src/commands/validate.js';

function seedRepo(dir, featureListOverrides = {}) {
  fs.mkdirSync(path.join(dir, 'docs', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ projectName: 'demo', requiredAdrTopics: [] }));
  const data = {
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
      evidence: [],
      source_refs: [],
      ...featureListOverrides,
    }],
  };
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify(data));
  return dir;
}

test('passes on a valid repo and writes a snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { id: 'M0-SCOPE-001' });
  const result = runValidate(dir);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(fs.existsSync(path.join(dir, '.harness', 'last-validated-features.json')), true);
});

test('returns ok:false instead of throwing when feature_list.json is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.mkdirSync(path.join(dir, 'docs', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ projectName: 'demo', requiredAdrTopics: [] }));
  const result = runValidate(dir);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].startsWith('feature_list.json:'));
});

test('returns ok:false instead of throwing when feature_list.json is malformed JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.mkdirSync(path.join(dir, 'docs', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ projectName: 'demo', requiredAdrTopics: [] }));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), '{ not valid json');
  const result = runValidate(dir);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].startsWith('feature_list.json:'));
});

test('fails and reports errors from a specific validator, prefixed by name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { id: 'M0-SCOPE-001', status: 'passing', evidence: [] });
  const result = runValidate(dir);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.startsWith('[pass-gate]')));
});
