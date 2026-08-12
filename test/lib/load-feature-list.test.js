import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadFeatureList } from '../../src/lib/load-feature-list.js';

test('loadFeatureList parses a valid feature_list.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const data = { project: 'demo', milestones: [], features: [] };
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify(data));

  assert.deepEqual(loadFeatureList(dir), data);
});

test('loadFeatureList throws a friendly error when the file is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));

  assert.throws(
    () => loadFeatureList(dir),
    (err) => err instanceof Error && err.message.includes('feature_list.json not found in') && err.message.includes('init'),
  );
});

test('loadFeatureList throws a friendly error when the file is malformed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), '{ not valid json');

  assert.throws(
    () => loadFeatureList(dir),
    (err) => err instanceof Error && err.message.startsWith('feature_list.json is not valid JSON:'),
  );
});
