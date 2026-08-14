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

test('Agent can create a feature non-interactively and record artifact approval through the CLI', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  execFileSync('node', [CLI, 'init'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'feature.json'), JSON.stringify({
    id: 'M0-FEAT-AGENT',
    milestone: 'M0',
    title: 'Agent input',
    behavior: 'Agent can create features without answering prompts',
    dependencies: [],
    verification: [{ type: 'automated', command: 'node --version', expected: 'exit 0' }],
    source_refs: ['docs/workflow/04-feature-breakdown.md'],
  }));

  const created = JSON.parse(execFileSync(
    'node', [CLI, 'new-feature', '--input', 'feature.json'], { cwd: dir },
  ).toString());
  assert.equal(created.id, 'M0-FEAT-AGENT');

  const approvalOut = execFileSync('node', [
    CLI, 'evidence', 'approval', 'docs/product/requirements-template.md',
    '--actor', 'human:owner', '--summary', 'Template shape approved',
  ], { cwd: dir }).toString();
  assert.match(approvalOut, /Recorded approval/);

  const status = JSON.parse(execFileSync('node', [CLI, 'status'], { cwd: dir }).toString());
  assert.equal(status.artifactApprovals[0].valid, true);
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

test('feature start, verify, review, and complete form an atomic Agent lifecycle via the CLI', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ defaultOwner: 'agent' }));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', rules: { wip_limit_per_owner: 1 }, milestones: [{ id: 'M0' }],
    features: [{
      id: 'M0-FEAT-001', milestone: 'M0', status: 'not_started', dependencies: [],
      verification: [{ type: 'automated', command: 'node -e "process.exit(0)"', expected: 'exit 0' }],
      evidence: [],
    }],
  }));
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir });

  assert.match(
    execFileSync('node', [CLI, 'feature', 'start', 'M0-FEAT-001'], { cwd: dir }).toString(),
    /Started M0-FEAT-001/,
  );
  assert.match(
    execFileSync('node', [CLI, 'verify', 'M0-FEAT-001'], { cwd: dir }).toString(),
    /All verification commands passed/,
  );
  assert.match(
    execFileSync('node', [
      CLI, 'review', 'record', 'M0-FEAT-001', '--reviewer', 'reviewer', '--summary', 'Behavior and security checked',
    ], { cwd: dir }).toString(),
    /Recorded passed review/,
  );
  assert.match(
    execFileSync('node', [CLI, 'feature', 'complete', 'M0-FEAT-001'], { cwd: dir }).toString(),
    /Completed M0-FEAT-001/,
  );

  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8')).features[0];
  assert.equal(saved.status, 'passing');
  assert.equal(saved.claim, null);
  assert.deepEqual(saved.evidence.map((evidence) => evidence.kind), ['test', 'review']);
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
