import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../src/lib/config.js';

test('loadConfig returns defaults when file is missing', () => {
  const config = loadConfig(path.join(os.tmpdir(), 'does-not-exist.json'));
  assert.deepEqual(config, {
    projectName: 'unnamed-project',
    requiredAdrTopics: [],
    testStrategy: 'isolated-tdd',
    defaultOwner: 'agent',
  });
});

test('loadConfig merges file contents over defaults', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ projectName: 'demo', requiredAdrTopics: ['data-model'] }));
  const config = loadConfig(configPath);
  assert.deepEqual(config, {
    projectName: 'demo',
    requiredAdrTopics: ['data-model'],
    testStrategy: 'isolated-tdd',
    defaultOwner: 'agent',
  });
});

test('loadConfig rejects an unknown testStrategy', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ testStrategy: 'vibes' }));
  assert.throws(() => loadConfig(configPath), /testStrategy must be one of/);
});
