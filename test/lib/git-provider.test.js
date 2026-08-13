import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { claimAndPush, GitPushConflictUnresolvedError, NoReadyFeatureError } from '../../src/lib/git-provider.js';
import { readEvents } from '../../src/lib/events.js';

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function configureIdentity(dir) {
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
}

function featureListWith(features) {
  return JSON.stringify({
    project: 'demo',
    schema_version: '1.0',
    rules: { wip_limit_per_owner: 5 },
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features,
  }, null, 2) + '\n';
}

function readFeature(dir, id) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8')).features.find((f) => f.id === id);
}

// Sets up: a bare "remote" repo, and two independent clones (simulating two
// machines) that both start from the same initial commit.
function setupTwoClones(features) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-gitprov-'));
  const barePath = path.join(root, 'bare.git');
  git(root, ['init', '--bare', '-b', 'main', barePath]);

  const seedPath = path.join(root, 'seed');
  git(root, ['clone', barePath, seedPath]);
  configureIdentity(seedPath);
  fs.writeFileSync(path.join(seedPath, 'feature_list.json'), featureListWith(features));
  git(seedPath, ['add', '-A']);
  git(seedPath, ['commit', '-m', 'initial']);
  git(seedPath, ['push', 'origin', 'main']);

  const cloneA = path.join(root, 'clone-a');
  const cloneB = path.join(root, 'clone-b');
  git(root, ['clone', barePath, cloneA]);
  git(root, ['clone', barePath, cloneB]);
  configureIdentity(cloneA);
  configureIdentity(cloneB);

  return { root, barePath, cloneA, cloneB };
}

test('claimAndPush succeeds directly when there is no race', () => {
  const { cloneA } = setupTwoClones([
    { id: 'M0-FEAT-001', milestone: 'M0', behavior: 'a', status: 'not_started', dependencies: [], verification: [], evidence: [] },
  ]);

  const result = claimAndPush(cloneA, 'M0-FEAT-001', { owner: 'alice' });
  assert.equal(result.status, 'claimed');
  assert.equal(result.featureId, 'M0-FEAT-001');
  assert.equal(readFeature(cloneA, 'M0-FEAT-001').claim.owner, 'alice');
});

test('two clones racing for the same feature: the second push loses and automatically falls back to the next ready feature', () => {
  const { cloneA, cloneB } = setupTwoClones([
    { id: 'M0-FEAT-001', milestone: 'M0', behavior: 'a', status: 'not_started', dependencies: [], verification: [], evidence: [] },
    { id: 'M0-FEAT-002', milestone: 'M0', behavior: 'b', status: 'not_started', dependencies: [], verification: [], evidence: [] },
  ]);

  // Clone A claims and pushes first — succeeds cleanly.
  const resultA = claimAndPush(cloneA, 'M0-FEAT-001', { owner: 'alice' });
  assert.equal(resultA.status, 'claimed');

  // Clone B, unaware A already pushed, also tries to claim the same
  // feature. Its local claim succeeds (it hasn't seen A's push yet), but
  // the push is rejected — this is the real cross-machine race.
  const resultB = claimAndPush(cloneB, 'M0-FEAT-001', { owner: 'bob' });
  assert.equal(resultB.status, 'claimed-fallback');
  assert.equal(resultB.originalFeatureId, 'M0-FEAT-001');
  assert.equal(resultB.featureId, 'M0-FEAT-002');

  // Clone B's local state must reflect reality after resync: M0-FEAT-001
  // belongs to alice (B never actually got it), M0-FEAT-002 belongs to bob.
  assert.equal(readFeature(cloneB, 'M0-FEAT-001').claim.owner, 'alice');
  assert.equal(readFeature(cloneB, 'M0-FEAT-002').claim.owner, 'bob');

  // And the remote (source of truth) agrees.
  const verifyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-verify-'));
  const checkDir = path.join(verifyDir, 'check');
  git(verifyDir, ['clone', path.join(path.dirname(cloneA), 'bare.git'), checkDir]);
  assert.equal(readFeature(checkDir, 'M0-FEAT-001').claim.owner, 'alice');
  assert.equal(readFeature(checkDir, 'M0-FEAT-002').claim.owner, 'bob');

  const monthKey = new Date().toISOString().slice(0, 7);
  const eventsB = readEvents(cloneB, monthKey).map((e) => e.type);
  assert.ok(eventsB.includes('git.push_conflict'));
  assert.ok(eventsB.includes('git.claim_conflict_resolved'));
});

test('claimAndPush throws NoReadyFeatureError when the race is lost and nothing else is ready', () => {
  const { cloneA, cloneB } = setupTwoClones([
    { id: 'M0-FEAT-001', milestone: 'M0', behavior: 'a', status: 'not_started', dependencies: [], verification: [], evidence: [] },
  ]);

  claimAndPush(cloneA, 'M0-FEAT-001', { owner: 'alice' });
  assert.throws(() => claimAndPush(cloneB, 'M0-FEAT-001', { owner: 'bob' }), NoReadyFeatureError);
});
