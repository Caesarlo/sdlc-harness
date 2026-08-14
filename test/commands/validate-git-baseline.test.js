import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runValidate } from '../../src/commands/validate.js';

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function initRepo(dir) {
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
}

function featureList(status) {
  return JSON.stringify({
    project: 'demo',
    schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features: [{
      id: 'M0-FEAT-001',
      milestone: 'M0',
      behavior: 'does a thing',
      status,
      dependencies: [],
      verification: [{ type: 'automated', command: 'true', expected: 'exit 0' }],
      evidence: status === 'passing' ? [
        { kind: 'test', command: 'true', result: 'passed', recorded_at: new Date().toISOString() },
        { kind: 'review', result: 'passed', recorded_at: new Date().toISOString() },
      ] : [],
      source_refs: ['docs/notes.md'],
    }],
  }, null, 2) + '\n';
}

function writeRepoFiles(dir, status) {
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'notes.md'), '# notes');
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ requiredAdrTopics: [] }));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), featureList(status));
}

test('validate catches a passing_is_monotonic regression via git history even with no local .harness/ snapshot (fresh checkout)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-git-'));
  initRepo(dir);

  // Commit 1 on main: the feature is passing.
  writeRepoFiles(dir, 'passing');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'feature passing']);

  // A "PR" branch that regresses the feature back to not_started.
  git(dir, ['checkout', '-b', 'feature/regress']);
  writeRepoFiles(dir, 'not_started');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'regress the feature']);

  // Simulate a genuinely fresh CI checkout: no .harness/ directory at all,
  // so the local snapshot cache has nothing to compare against — only git
  // history can catch this.
  assert.equal(fs.existsSync(path.join(dir, '.harness')), false);

  const previousEnv = process.env.HARNESS_BASE_REF;
  process.env.HARNESS_BASE_REF = 'main';
  try {
    const result = runValidate(dir);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('passing_is_monotonic')));
    assert.ok(result.errors.some((e) => e.includes('M0-FEAT-001')));
  } finally {
    if (previousEnv === undefined) delete process.env.HARNESS_BASE_REF;
    else process.env.HARNESS_BASE_REF = previousEnv;
  }
});

test('validate passes when there is no regression against the git baseline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-git-'));
  initRepo(dir);

  writeRepoFiles(dir, 'passing');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'feature passing']);

  git(dir, ['checkout', '-b', 'feature/unrelated']);
  // No changes to feature_list.json — still passing.

  const previousEnv = process.env.HARNESS_BASE_REF;
  process.env.HARNESS_BASE_REF = 'main';
  try {
    const result = runValidate(dir);
    assert.equal(result.ok, true);
  } finally {
    if (previousEnv === undefined) delete process.env.HARNESS_BASE_REF;
    else process.env.HARNESS_BASE_REF = previousEnv;
  }
});

test('validate falls back to passing (no false positive) when neither git history nor a local snapshot is available', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-nogit-'));
  writeRepoFiles(dir, 'passing');
  // Not a git repo at all, and no .harness/ snapshot — resolveBaseRef must
  // return null gracefully rather than throwing.
  const result = runValidate(dir);
  assert.equal(result.ok, true);
});
