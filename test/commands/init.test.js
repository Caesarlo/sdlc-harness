import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInit, InitConflictError } from '../../src/commands/init.js';
import { validateStructural } from '../../src/validators/structural.js';
import { validateDependencyCycles } from '../../src/validators/dependency-cycles.js';
import { validatePassGate } from '../../src/validators/pass-gate.js';
import { validateDependencyReadiness } from '../../src/validators/dependency-readiness.js';
import { validateMilestoneOrder } from '../../src/validators/milestone-order.js';
import { validateStageGate } from '../../src/validators/stage-gate.js';

test('init writes the full skeleton into an empty directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const written = runInit(dir, { projectName: 'demo-project' });

  assert.ok(written.length > 10);
  for (const expected of [
    'feature_list.json', 'feature_list.schema.json', 'AGENTS.md', 'progress.md',
    'harness.config.json', 'docs/adr/template.md',
    ...Array.from({ length: 9 }, (_, i) => `docs/workflow/${String(i + 1).padStart(2, '0')}`),
  ]) {
    assert.ok(
      fs.existsSync(path.join(dir, expected)) || fs.readdirSync(path.join(dir, 'docs', 'workflow')).some((f) => f.startsWith(expected.split('/').pop())),
      `expected ${expected} to exist`,
    );
  }
});

test('init writes the git hook and CI deploy workflow into dot-directories', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  runInit(dir, { projectName: 'demo-project' });
  const hookPath = path.join(dir, '.githooks', 'pre-commit');
  assert.equal(fs.existsSync(hookPath), true);
  // POSIX-only: Windows' fs.chmod/stat do not model owner/group/other execute bits,
  // so asserting the exact mode there would be flaky rather than meaningful.
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(hookPath).mode & 0o111, 0o111);
  }
  assert.equal(fs.existsSync(path.join(dir, '.github', 'workflows', 'deploy.yml')), true);
  assert.equal(fs.existsSync(path.join(dir, '.github', 'workflows', 'ci.yml')), true);
});

test('init writes a .gitignore that ignores only the derived local snapshot, not events/ or feature_list.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  runInit(dir, { projectName: 'demo-project' });
  const gitignorePath = path.join(dir, '.gitignore');
  assert.equal(fs.existsSync(gitignorePath), true);

  const content = fs.readFileSync(gitignorePath, 'utf8');
  assert.match(content, /\.harness\/last-validated-features\.json/);
  assert.match(content, /^\.worktrees\/\s*$/m);
  // Must not blanket-ignore the whole .harness/ directory — events/ and any
  // future claims/ data need to be trackable for team sync.
  assert.doesNotMatch(content, /^\.harness\/\s*$/m);
});

test('init refuses to overwrite a pre-existing file and reports the conflict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'do not touch me');

  assert.throws(() => runInit(dir, { projectName: 'demo-project' }), InitConflictError);
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'do not touch me');
  // Nothing else should have been written either — a conflict aborts the
  // whole init rather than leaving a half-written skeleton behind.
  assert.equal(fs.existsSync(path.join(dir, 'feature_list.json')), false);
});

test('init --force overwrites conflicting files and still writes everything else', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'stale content');

  const written = runInit(dir, { projectName: 'demo-project', force: true });

  assert.ok(written.length > 10);
  assert.notEqual(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'stale content');
  assert.equal(fs.existsSync(path.join(dir, 'feature_list.json')), true);
});

test('the freshly-initialized feature_list.json passes every validator', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  runInit(dir, { projectName: 'demo-project' });
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));

  for (const result of [
    validateStructural(data),
    validateDependencyCycles(data),
    validatePassGate(data, null),
    validateDependencyReadiness(data),
    validateMilestoneOrder(data),
    validateStageGate(data, dir),
  ]) {
    assert.deepEqual(result, { ok: true, errors: [] });
  }
});
