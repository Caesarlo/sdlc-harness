import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  claimFeature, claimNextFeature, releaseFeature, renewClaim, takeoverExpiredClaim, listReadyFeatures,
  ClaimConflictError, WipLimitExceededError, NotClaimOwnerError, ClaimNotExpiredError, NoClaimError, NoReadyFeatureError,
} from '../../src/lib/claims.js';
import { FeatureNotFoundError } from '../../src/lib/errors.js';
import { readEvents } from '../../src/lib/events.js';

function seedRepo(dir, { rules, features } = {}) {
  const featureListPath = path.join(dir, 'feature_list.json');
  fs.writeFileSync(featureListPath, JSON.stringify({
    project: 'demo',
    schema_version: '1.0',
    rules: rules || { wip_limit_per_owner: 1 },
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features: features || [
      { id: 'M0-FEAT-001', milestone: 'M0', behavior: 'a', status: 'not_started', dependencies: [], verification: [], evidence: [] },
      { id: 'M0-FEAT-002', milestone: 'M0', behavior: 'b', status: 'not_started', dependencies: [], verification: [], evidence: [] },
    ],
  }));
  return featureListPath;
}

function readFeature(featureListPath, id) {
  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  return data.features.find((f) => f.id === id);
}

test('claimFeature sets claim, owner, and flips not_started to in_progress', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);

  const claim = claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  assert.equal(claim.owner, 'alice');
  assert.equal(claim.actor_id, 'alice');
  assert.ok(claim.id);
  assert.ok(claim.lease_until);

  const feature = readFeature(featureListPath, 'M0-FEAT-001');
  assert.equal(feature.status, 'in_progress');
  assert.equal(feature.owner, 'alice');
  assert.equal(feature.claim.id, claim.id);
});

test('claimFeature rejects a feature already claimed by someone else', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { rules: { wip_limit_per_owner: 5 } });

  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  assert.throws(() => claimFeature(dir, 'M0-FEAT-001', { owner: 'bob' }), ClaimConflictError);
});

test('actor_id distinguishes two Agent sessions under the same owner without letting them double-claim one feature', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, { rules: { wip_limit_per_owner: 2 } });

  const claim1 = claimFeature(dir, 'M0-FEAT-001', { owner: 'alice', actorId: 'alice-agent-1' });
  const claim2 = claimFeature(dir, 'M0-FEAT-002', { owner: 'alice', actorId: 'alice-agent-2' });
  assert.notEqual(claim1.actor_id, claim2.actor_id);

  // Same owner, same feature — still rejected regardless of actor_id, because
  // claim uniqueness is keyed on feature id, not (owner, actor_id).
  assert.throws(() => claimFeature(dir, 'M0-FEAT-001', { owner: 'alice', actorId: 'alice-agent-3' }), ClaimConflictError);

  const f1 = readFeature(featureListPath, 'M0-FEAT-001');
  const f2 = readFeature(featureListPath, 'M0-FEAT-002');
  assert.equal(f1.claim.actor_id, 'alice-agent-1');
  assert.equal(f2.claim.actor_id, 'alice-agent-2');
});

test('WIP limit is enforced per owner, counting only unexpired claims', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { rules: { wip_limit_per_owner: 1 } });

  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  assert.throws(() => claimFeature(dir, 'M0-FEAT-002', { owner: 'alice' }), WipLimitExceededError);

  // A different owner is unaffected by alice's WIP usage.
  const claim = claimFeature(dir, 'M0-FEAT-002', { owner: 'bob' });
  assert.equal(claim.owner, 'bob');
});

test('claimFeature throws FeatureNotFoundError for an unknown id', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir);
  assert.throws(() => claimFeature(dir, 'DOES-NOT-EXIST', { owner: 'alice' }), FeatureNotFoundError);
});

test('releaseFeature clears the claim and is idempotent when already released', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);

  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  releaseFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  const feature = readFeature(featureListPath, 'M0-FEAT-001');
  assert.equal(feature.claim, null);
  // Release must undo the in_progress flip claim made, otherwise the
  // feature never becomes ready again and pass-gate's status-based WIP
  // count would drift from claims.js's claim-based WIP count.
  assert.equal(feature.status, 'not_started');

  // Releasing again should not throw.
  releaseFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
});

test('releaseFeature rejects a caller who does not hold the claim', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { rules: { wip_limit_per_owner: 5 } });

  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  assert.throws(() => releaseFeature(dir, 'M0-FEAT-001', { owner: 'bob' }), NotClaimOwnerError);
});

test('a released claim frees up the owner\'s WIP slot for a new claim', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { rules: { wip_limit_per_owner: 1 } });

  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  releaseFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  const claim = claimFeature(dir, 'M0-FEAT-002', { owner: 'alice' });
  assert.equal(claim.owner, 'alice');
});

test('renewClaim extends the lease and rejects a non-owner', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);

  const original = claimFeature(dir, 'M0-FEAT-001', { owner: 'alice', ttlMinutes: 1 });
  renewClaim(dir, 'M0-FEAT-001', { owner: 'alice', ttlMinutes: 999 });
  const renewed = readFeature(featureListPath, 'M0-FEAT-001').claim;
  assert.ok(new Date(renewed.lease_until).getTime() > new Date(original.lease_until).getTime());

  assert.throws(() => renewClaim(dir, 'M0-FEAT-001', { owner: 'bob' }), NotClaimOwnerError);
});

test('renewClaim throws NoClaimError when there is nothing to renew', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir);
  assert.throws(() => renewClaim(dir, 'M0-FEAT-001', { owner: 'alice' }), NoClaimError);
});

test('takeoverExpiredClaim rejects a still-valid lease and succeeds once expired', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, { rules: { wip_limit_per_owner: 5 } });

  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice', ttlMinutes: 999 });
  assert.throws(() => takeoverExpiredClaim(dir, 'M0-FEAT-001', { owner: 'bob' }), ClaimNotExpiredError);

  // Force the lease into the past to simulate an expired claim.
  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features[0].claim.lease_until = new Date(Date.now() - 60_000).toISOString();
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');

  const claim = takeoverExpiredClaim(dir, 'M0-FEAT-001', { owner: 'bob' });
  assert.equal(claim.owner, 'bob');
  assert.equal(claim.taken_over_from, 'alice');
  assert.equal(readFeature(featureListPath, 'M0-FEAT-001').owner, 'bob');
});

test('claimNextFeature picks a ready feature and skips ones with unmet dependencies', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, {
    rules: { wip_limit_per_owner: 5 },
    features: [
      { id: 'M0-FEAT-001', milestone: 'M0', behavior: 'a', status: 'not_started', dependencies: ['M0-FEAT-000'], verification: [], evidence: [] },
      { id: 'M0-FEAT-002', milestone: 'M0', behavior: 'b', status: 'not_started', dependencies: [], verification: [], evidence: [] },
    ],
  });

  const ready = listReadyFeatures(JSON.parse(fs.readFileSync(featureListPath, 'utf8')));
  assert.deepEqual(ready.map((f) => f.id), ['M0-FEAT-002']);

  const claim = claimNextFeature(dir, { owner: 'alice' });
  assert.equal(claim.feature_id, 'M0-FEAT-002');
});

test('claimNextFeature throws NoReadyFeatureError when nothing qualifies', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, {
    features: [
      { id: 'M0-FEAT-001', milestone: 'M0', behavior: 'a', status: 'blocked', dependencies: [], verification: [], evidence: [] },
    ],
  });
  assert.throws(() => claimNextFeature(dir, { owner: 'alice' }), NoReadyFeatureError);
});

test('claim, release, and takeover each append an audit event', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, { rules: { wip_limit_per_owner: 5 } });

  claimFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  releaseFeature(dir, 'M0-FEAT-001', { owner: 'alice' });
  claimFeature(dir, 'M0-FEAT-001', { owner: 'bob', ttlMinutes: 999 });

  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features[0].claim.lease_until = new Date(Date.now() - 60_000).toISOString();
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');
  takeoverExpiredClaim(dir, 'M0-FEAT-001', { owner: 'carol' });

  const monthKey = new Date().toISOString().slice(0, 7);
  const types = readEvents(dir, monthKey).map((e) => e.type);
  assert.deepEqual(types, ['feature.claimed', 'feature.released', 'feature.claimed', 'claim.taken_over']);
});
