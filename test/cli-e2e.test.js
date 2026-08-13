import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.js');

test('init then validate then status succeed end-to-end via the CLI binary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));

  const initOut = execFileSync('node', [CLI, 'init'], { cwd: dir }).toString();
  assert.match(initOut, /Wrote \d+ files\./);

  const validateOut = execFileSync('node', [CLI, 'validate'], { cwd: dir }).toString();
  assert.match(validateOut, /All checks passed\./);

  const statusOut = execFileSync('node', [CLI, 'status'], { cwd: dir }).toString();
  const status = JSON.parse(statusOut);
  assert.equal(status.counts.not_started, 1);
  assert.equal(status.milestoneCount, 1);

  assert.equal(fs.existsSync(path.join(dir, '.claude', 'skills', 'requirements', 'SKILL.md')), true);
});

test('adopt on a directory with an existing AGENTS.md reports it as skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM');

  const adoptOut = execFileSync('node', [CLI, 'adopt'], { cwd: dir }).toString();
  assert.match(adoptOut, /skipped 1 existing files?/);
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'CUSTOM');
});

test('new-feature with a duplicate id exits non-zero with a clean error, not a raw stack trace', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }],
    features: [{ id: 'M0-FEAT-001', milestone: 'M0', dependencies: [], verification: [] }],
  }));

  let threw = false;
  try {
    execFileSync('node', [CLI, 'new-feature'], { cwd: dir, input: 'M0-FEAT-001\n' });
  } catch (err) {
    threw = true;
    assert.notEqual(err.status, 0);
    const stderr = err.stderr.toString();
    assert.match(stderr, /Feature id already exists: M0-FEAT-001/);
    assert.doesNotMatch(stderr, /UnhandledPromiseRejection/);
    assert.doesNotMatch(stderr, /at\s+\S+\s+\(.*:\d+:\d+\)/);
  }
  assert.equal(threw, true);
});

test('verify runs the declared command via the CLI binary, exits non-zero on failure, and records real evidence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = path.join(dir, 'feature_list.json');
  fs.writeFileSync(featureListPath, JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }],
    features: [{
      id: 'M0-FEAT-001', milestone: 'M0', dependencies: [],
      verification: [{ type: 'automated', command: 'node -e "process.exit(1)"', expected: 'exit 0' }],
      evidence: [],
    }],
  }));

  let threw = false;
  try {
    execFileSync('node', [CLI, 'verify', 'M0-FEAT-001'], { cwd: dir });
  } catch (err) {
    threw = true;
    assert.notEqual(err.status, 0);
  }
  assert.equal(threw, true);

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  assert.equal(saved.features[0].evidence.length, 1);
  assert.equal(saved.features[0].evidence[0].result, 'failed');
  assert.equal(saved.features[0].evidence[0].kind, 'test');
});

test('claim, release, and claim --next work end-to-end via the CLI binary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ defaultOwner: 'agent' }));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', rules: { wip_limit_per_owner: 1 }, milestones: [{ id: 'M0' }],
    features: [
      { id: 'M0-FEAT-001', milestone: 'M0', dependencies: [], verification: [], evidence: [], status: 'not_started' },
    ],
  }));

  const claimOut = execFileSync('node', [CLI, 'claim', 'M0-FEAT-001'], { cwd: dir }).toString();
  assert.match(claimOut, /Claimed M0-FEAT-001 for agent/);

  let saved = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(saved.features[0].status, 'in_progress');
  assert.equal(saved.features[0].claim.owner, 'agent');

  // A second claim on the same already-claimed feature must fail cleanly.
  let threw = false;
  try {
    execFileSync('node', [CLI, 'claim', 'M0-FEAT-001'], { cwd: dir });
  } catch (err) {
    threw = true;
    assert.notEqual(err.status, 0);
  }
  assert.equal(threw, true);

  const releaseOut = execFileSync('node', [CLI, 'release', 'M0-FEAT-001'], { cwd: dir }).toString();
  assert.match(releaseOut, /Released M0-FEAT-001/);
  saved = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(saved.features[0].claim, null);

  const nextOut = execFileSync('node', [CLI, 'claim', '--next'], { cwd: dir }).toString();
  assert.match(nextOut, /Claimed M0-FEAT-001 for agent/);
});

test('workspace create/status/remove work end-to-end via the CLI binary against a real git repo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });

  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ defaultOwner: 'agent' }));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', rules: { wip_limit_per_owner: 1 }, milestones: [{ id: 'M0' }],
    features: [{ id: 'M0-FEAT-001', milestone: 'M0', dependencies: [], verification: [], evidence: [], status: 'not_started' }],
  }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir });

  execFileSync('node', [CLI, 'claim', 'M0-FEAT-001'], { cwd: dir });

  const createOut = execFileSync('node', [CLI, 'workspace', 'create', 'M0-FEAT-001'], { cwd: dir }).toString();
  assert.match(createOut, /Created workspace for M0-FEAT-001/);

  const worktreePath = path.join(dir, '.worktrees', 'M0-FEAT-001');
  assert.equal(fs.existsSync(worktreePath), true);

  const statusOut = JSON.parse(execFileSync('node', [CLI, 'workspace', 'status'], { cwd: dir }).toString());
  assert.equal(statusOut.length, 1);
  assert.equal(statusOut[0].featureId, 'M0-FEAT-001');

  const removeOut = execFileSync('node', [CLI, 'workspace', 'remove', 'M0-FEAT-001'], { cwd: dir }).toString();
  assert.match(removeOut, /Removed workspace for M0-FEAT-001/);
  assert.equal(fs.existsSync(worktreePath), false);
});
