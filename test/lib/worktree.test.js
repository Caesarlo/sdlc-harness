import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createWorkspace, removeWorkspace, pruneWorkspaces, listWorkspaces,
  NoActiveClaimError, WorkspaceExistsError, NoWorkspaceError, DirtyWorkspaceError,
} from '../../src/lib/worktree.js';
import { claimFeature, releaseFeature } from '../../src/lib/claims.js';
import { FeatureNotFoundError } from '../../src/lib/errors.js';

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function initRepoWithFeature(featureId = 'M0-FEAT-001') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-wt-'));
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);

  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo',
    schema_version: '1.0',
    rules: { wip_limit_per_owner: 5 },
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features: [{
      id: featureId, milestone: 'M0', behavior: 'a', status: 'not_started',
      dependencies: [], verification: [], evidence: [],
    }],
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'initial']);

  return dir;
}

function readFeature(dir, featureId) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'))
    .features.find((f) => f.id === featureId);
}

test('createWorkspace requires an active claim first', () => {
  const dir = initRepoWithFeature();
  assert.throws(() => createWorkspace(dir, 'M0-FEAT-001'), NoActiveClaimError);
});

test('createWorkspace makes a real git worktree on its own branch and records it on the feature', () => {
  const dir = initRepoWithFeature();
  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });

  const workspace = createWorkspace(dir, 'M0-FEAT-001', { baseBranch: 'main' });
  assert.equal(workspace.branch, 'feature/M0-FEAT-001');
  assert.ok(fs.existsSync(workspace.path));
  assert.ok(fs.existsSync(path.join(workspace.path, 'README.md')));

  const branches = git(dir, ['branch', '--list', 'feature/M0-FEAT-001']);
  assert.match(branches, /feature\/M0-FEAT-001/);

  const feature = readFeature(dir, 'M0-FEAT-001');
  assert.equal(feature.workspace.branch, 'feature/M0-FEAT-001');
  assert.ok(feature.workspace.base_commit);
});

test('createWorkspace refuses a second workspace for the same feature', () => {
  const dir = initRepoWithFeature();
  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  createWorkspace(dir, 'M0-FEAT-001');
  assert.throws(() => createWorkspace(dir, 'M0-FEAT-001'), WorkspaceExistsError);
});

test('createWorkspace throws FeatureNotFoundError for an unknown feature', () => {
  const dir = initRepoWithFeature();
  assert.throws(() => createWorkspace(dir, 'NOPE'), FeatureNotFoundError);
});

test('removeWorkspace refuses a clean removal when there are uncommitted changes, succeeds with force', () => {
  const dir = initRepoWithFeature();
  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  const workspace = createWorkspace(dir, 'M0-FEAT-001');

  fs.writeFileSync(path.join(workspace.path, 'scratch.txt'), 'wip');

  assert.throws(() => removeWorkspace(dir, 'M0-FEAT-001'), DirtyWorkspaceError);
  assert.ok(fs.existsSync(workspace.path), 'dirty workspace must survive a non-forced remove');

  removeWorkspace(dir, 'M0-FEAT-001', { force: true });
  assert.equal(fs.existsSync(workspace.path), false);
  assert.equal(readFeature(dir, 'M0-FEAT-001').workspace, null);
});

test('removeWorkspace refuses when there are committed-but-unpushed commits, even with a clean working tree', () => {
  const dir = initRepoWithFeature();
  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  const workspace = createWorkspace(dir, 'M0-FEAT-001');

  fs.writeFileSync(path.join(workspace.path, 'scratch.txt'), 'committed work');
  git(workspace.path, ['add', '-A']);
  git(workspace.path, ['commit', '-m', 'wip']);

  assert.throws(() => removeWorkspace(dir, 'M0-FEAT-001'), DirtyWorkspaceError);
});

test('removeWorkspace succeeds cleanly when there is nothing uncommitted or unpushed', () => {
  const dir = initRepoWithFeature();
  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  const workspace = createWorkspace(dir, 'M0-FEAT-001');

  removeWorkspace(dir, 'M0-FEAT-001');
  assert.equal(fs.existsSync(workspace.path), false);
  assert.equal(git(dir, ['branch', '--list', 'feature/M0-FEAT-001']).trim(), '');
});

test('removeWorkspace throws NoWorkspaceError when there is nothing to remove', () => {
  const dir = initRepoWithFeature();
  assert.throws(() => removeWorkspace(dir, 'M0-FEAT-001'), NoWorkspaceError);
});

test('pruneWorkspaces never touches a workspace whose claim is still active', () => {
  const dir = initRepoWithFeature();
  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice', ttlMinutes: 999 });
  const workspace = createWorkspace(dir, 'M0-FEAT-001');

  const results = pruneWorkspaces(dir);
  assert.deepEqual(results, []);
  assert.ok(fs.existsSync(workspace.path));
});

test('pruneWorkspaces removes clean workspaces whose claim has been released, and reports dirty ones as skipped', () => {
  const dir = initRepoWithFeature();
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', rules: { wip_limit_per_owner: 5 },
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features: [
      { id: 'M0-FEAT-001', milestone: 'M0', behavior: 'a', status: 'not_started', dependencies: [], verification: [], evidence: [] },
      { id: 'M0-FEAT-002', milestone: 'M0', behavior: 'b', status: 'not_started', dependencies: [], verification: [], evidence: [] },
    ],
  }, null, 2) + '\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'two features']);

  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  const ws1 = createWorkspace(dir, 'M0-FEAT-001');
  releaseFeature(dir, 'M0-FEAT-001', { owner: 'alice' });

  claimFeature(dir, 'M0-FEAT-002', { owner: 'bob' });
  const ws2 = createWorkspace(dir, 'M0-FEAT-002');
  fs.writeFileSync(path.join(ws2.path, 'dirty.txt'), 'uncommitted');
  releaseFeature(dir, 'M0-FEAT-002', { owner: 'bob' });

  const results = pruneWorkspaces(dir).sort((a, b) => a.featureId.localeCompare(b.featureId));
  assert.deepEqual(results, [
    { featureId: 'M0-FEAT-001', action: 'removed' },
    { featureId: 'M0-FEAT-002', action: 'skipped-dirty', reason: 'uncommitted changes are present' },
  ]);
  assert.equal(fs.existsSync(ws1.path), false);
  assert.ok(fs.existsSync(ws2.path), 'dirty workspace must survive prune without force');
});

test('listWorkspaces reports claim activity and on-disk existence', () => {
  const dir = initRepoWithFeature();
  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice', ttlMinutes: 999 });
  createWorkspace(dir, 'M0-FEAT-001');

  const list = listWorkspaces(dir);
  assert.equal(list.length, 1);
  assert.equal(list[0].featureId, 'M0-FEAT-001');
  assert.equal(list[0].claimActive, true);
  assert.equal(list[0].existsOnDisk, true);
});
