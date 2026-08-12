import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdopt } from '../../src/commands/adopt.js';

test('adopt never overwrites an existing file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM EXISTING CONTENT');

  const written = runAdopt(dir, { projectName: 'demo-project' });

  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'CUSTOM EXISTING CONTENT');
  const agentsEntry = written.find((w) => w.path.endsWith('AGENTS.md'));
  assert.equal(agentsEntry.action, 'skipped-exists');
});

test('adopt inserts missing files alongside existing ones', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM EXISTING CONTENT');

  runAdopt(dir, { projectName: 'demo-project' });

  assert.equal(fs.existsSync(path.join(dir, 'feature_list.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'docs', 'workflow', '01-requirements.md')), true);
});
