import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdopt } from '../../src/commands/adopt.js';
import { validateStructural } from '../../src/validators/structural.js';
import { validateDependencyCycles } from '../../src/validators/dependency-cycles.js';
import { validatePassGate } from '../../src/validators/pass-gate.js';
import { validateMilestoneOrder } from '../../src/validators/milestone-order.js';
import { validateStageGate } from '../../src/validators/stage-gate.js';

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
  assert.equal(fs.existsSync(path.join(dir, '.gitignore')), true);
});

test('adopt does not overwrite a project\'s existing .gitignore', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, '.gitignore'), 'dist/\n');

  runAdopt(dir, { projectName: 'demo-project' });

  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'dist/\n');
});

test('adopt writes a sidecar AGENTS.sdlc-harness.md when AGENTS.md already exists, without touching it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM EXISTING CONTENT');

  const written = runAdopt(dir, { projectName: 'demo-project' });

  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'CUSTOM EXISTING CONTENT');
  const sidecarPath = path.join(dir, 'AGENTS.sdlc-harness.md');
  assert.equal(fs.existsSync(sidecarPath), true);
  assert.match(fs.readFileSync(sidecarPath, 'utf8'), /Startup Workflow/);
  const sidecarEntry = written.find((w) => w.path === sidecarPath);
  assert.equal(sidecarEntry.action, 'written');
});

test('adopt does not write a sidecar when AGENTS.md did not already exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  runAdopt(dir, { projectName: 'demo-project' });
  assert.equal(fs.existsSync(path.join(dir, 'AGENTS.sdlc-harness.md')), false);
});

test('re-running adopt does not overwrite an already-written sidecar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM EXISTING CONTENT');
  runAdopt(dir, { projectName: 'demo-project' });

  const sidecarPath = path.join(dir, 'AGENTS.sdlc-harness.md');
  fs.writeFileSync(sidecarPath, 'HAND EDITED');
  runAdopt(dir, { projectName: 'demo-project' });
  assert.equal(fs.readFileSync(sidecarPath, 'utf8'), 'HAND EDITED');
});

test('the feature_list.json adopted into a partially-existing repo passes every validator', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM EXISTING CONTENT');

  runAdopt(dir, { projectName: 'demo-project' });
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));

  for (const result of [
    validateStructural(data),
    validateDependencyCycles(data),
    validatePassGate(data, null),
    validateMilestoneOrder(data),
    validateStageGate(data, dir),
  ]) {
    assert.deepEqual(result, { ok: true, errors: [] });
  }
});
