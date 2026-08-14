import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startFeature, completeFeature, blockFeature, reopenFeature } from '../../src/commands/feature.js';
import { recordReview } from '../../src/commands/review.js';
import { recordManualEvidence } from '../../src/commands/manual-evidence.js';
import { readEvents } from '../../src/lib/events.js';

function seedRepo(dir, overrides = {}) {
  const feature = {
    id: 'M0-FEAT-001', milestone: 'M0', title: 'Feature', behavior: 'works',
    status: 'not_started', dependencies: [],
    verification: [{ type: 'automated', command: 'npm test', expected: 'exit 0' }],
    evidence: [], blocker: null,
    ...overrides,
  };
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', rules: { wip_limit_per_owner: 1 },
    milestones: [{ id: 'M0', title: 'M0', objective: 'Ship' }], features: [feature],
  }, null, 2));
  return path.join(dir, 'feature_list.json');
}

test('feature complete atomically requires claim, verification, and later review evidence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);
  startFeature(dir, 'M0-FEAT-001', { owner: 'agent' });

  assert.throws(() => completeFeature(dir, 'M0-FEAT-001', { owner: 'agent' }), /missing passing evidence/);

  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features[0].evidence.push({
    kind: 'test', command: 'npm test', result: 'passed', recorded_at: '2026-01-01T00:00:00.000Z', commit_sha: null,
  });
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');
  recordReview(dir, 'M0-FEAT-001', { reviewer: 'reviewer', result: 'passed', summary: 'Behavior and security checked' });

  completeFeature(dir, 'M0-FEAT-001', { owner: 'agent' });
  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8')).features[0];
  assert.equal(saved.status, 'passing');
  assert.equal(saved.claim, null);

  const monthKey = new Date().toISOString().slice(0, 7);
  assert.deepEqual(
    readEvents(dir, monthKey).map((event) => event.type),
    ['feature.claimed', 'review.recorded', 'feature.completed'],
  );
});

test('feature complete rejects a review recorded before the latest verification', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);
  startFeature(dir, 'M0-FEAT-001', { owner: 'agent' });
  recordReview(dir, 'M0-FEAT-001', { reviewer: 'reviewer', summary: 'Reviewed too early' });

  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features[0].evidence.push({
    kind: 'test', command: 'npm test', result: 'passed', recorded_at: new Date(Date.now() + 1000).toISOString(), commit_sha: null,
  });
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');

  assert.throws(() => completeFeature(dir, 'M0-FEAT-001', { owner: 'agent' }), /review recorded after verification/);
});

test('feature complete rejects review evidence recorded by the claim owner', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);
  startFeature(dir, 'M0-FEAT-001', { owner: 'agent' });

  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features[0].evidence.push({
    kind: 'test', command: 'npm test', result: 'passed', recorded_at: '2026-01-01T00:00:00.000Z', commit_sha: null,
  });
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');
  recordReview(dir, 'M0-FEAT-001', { reviewer: 'agent', result: 'passed', summary: 'Self-reviewed' });

  assert.throws(
    () => completeFeature(dir, 'M0-FEAT-001', { owner: 'agent' }),
    /only has review evidence from its own claim owner/,
  );
});

test('block releases a claim and reopen returns the feature to not_started', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);
  startFeature(dir, 'M0-FEAT-001', { owner: 'agent' });
  blockFeature(dir, 'M0-FEAT-001', { owner: 'agent', reason: 'Waiting for API credentials' });

  let feature = JSON.parse(fs.readFileSync(featureListPath, 'utf8')).features[0];
  assert.equal(feature.status, 'blocked');
  assert.equal(feature.claim, null);
  assert.equal(feature.blocker, 'Waiting for API credentials');

  reopenFeature(dir, 'M0-FEAT-001', { actor: 'agent' });
  feature = JSON.parse(fs.readFileSync(featureListPath, 'utf8')).features[0];
  assert.equal(feature.status, 'not_started');
  assert.equal(feature.blocker, null);
});

test('manual evidence is bound to a declared manual verification', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, {
    verification: [{ type: 'manual', command: 'Open the page', expected: 'The page is usable' }],
  });
  startFeature(dir, 'M0-FEAT-001', { owner: 'agent' });

  const evidence = recordManualEvidence(dir, 'M0-FEAT-001', {
    verificationIndex: 1, result: 'passed', notes: 'Checked the primary flow', actor: 'qa',
  });
  assert.equal(evidence.kind, 'manual');
  assert.equal(evidence.verification_index, 1);
  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8')).features[0];
  assert.equal(saved.evidence[0].actor, 'qa');
});

test('feature start rejects non-ready work before mutating state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, { dependencies: ['M0-DEP-001'] });
  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features.push({ id: 'M0-DEP-001', milestone: 'M0', status: 'not_started', dependencies: [], verification: [] });
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');

  assert.throws(() => startFeature(dir, 'M0-FEAT-001', { owner: 'agent' }), /unmet dependencies/);
  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8')).features[0];
  assert.equal(saved.status, 'not_started');
  assert.equal(saved.claim, undefined);
});
