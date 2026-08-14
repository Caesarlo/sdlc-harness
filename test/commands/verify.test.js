import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runVerify, FeatureNotFoundError } from '../../src/commands/verify.js';
import { readEvents } from '../../src/lib/events.js';

function seedRepo(dir, verification) {
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo',
    schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features: [{
      id: 'M0-FEAT-001',
      milestone: 'M0',
      behavior: 'does a thing',
      status: 'in_progress',
      dependencies: [],
      verification,
      evidence: [],
    }],
  }));
  return path.join(dir, 'feature_list.json');
}

const NODE_TRUE = `node -e "process.exit(0)"`;
const NODE_FALSE = `node -e "process.exit(1)"`;

test('verify runs the real command and records passing evidence with an exit code', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, [{ type: 'automated', command: NODE_TRUE, expected: 'exit 0' }]);

  const result = runVerify(dir, 'M0-FEAT-001');
  assert.equal(result.ok, true);

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  const evidence = saved.features[0].evidence;
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].kind, 'test');
  assert.equal(evidence[0].result, 'passed');
  assert.equal(evidence[0].exit_code, 0);
  assert.ok(evidence[0].recorded_at);

  // Solo mode (the default) auto-claims before running and auto-releases
  // after, invisibly — both show up in the audit log around the verify
  // event itself.
  const monthKey = new Date().toISOString().slice(0, 7);
  const events = readEvents(dir, monthKey);
  assert.deepEqual(events.map((e) => e.type), ['feature.claimed', 'feature.verified', 'feature.released']);
  assert.equal(events[1].feature_id, 'M0-FEAT-001');
  assert.equal(events[1].ok, true);

  // And the auto-claim must not linger afterward.
  const savedFeature = JSON.parse(fs.readFileSync(featureListPath, 'utf8')).features[0];
  assert.equal(savedFeature.claim, null);
});

test('verify records a failing command as failed evidence and returns ok:false, without throwing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, [{ type: 'automated', command: NODE_FALSE, expected: 'exit 0' }]);

  const result = runVerify(dir, 'M0-FEAT-001');
  assert.equal(result.ok, false);

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  const evidence = saved.features[0].evidence;
  assert.equal(evidence[0].result, 'failed');
  assert.equal(evidence[0].exit_code, 1);
});

test('verify throws FeatureNotFoundError for an unknown feature id', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, [{ type: 'automated', command: NODE_TRUE, expected: 'exit 0' }]);

  assert.throws(() => runVerify(dir, 'DOES-NOT-EXIST'), FeatureNotFoundError);
});

test('verify never accepts a hand-supplied result — it always runs the command itself', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, [{ type: 'automated', command: NODE_FALSE, expected: 'exit 0' }]);

  // Even if the caller only has a reference to the exported function (no way
  // to pass in a fabricated exit code/result), the recorded evidence must
  // reflect the command's real outcome.
  runVerify(dir, 'M0-FEAT-001');
  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  assert.equal(saved.features[0].evidence[0].result, 'failed');
});

test('verify retries once and preserves a concurrent writer\'s change instead of clobbering it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, [{ type: 'automated', command: NODE_TRUE, expected: 'exit 0' }]);

  const exec = (...args) => {
    // Simulate a concurrent writer landing after verify has read the file
    // but before it writes back its evidence.
    const concurrent = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
    concurrent.features.push({ id: 'M0-FEAT-CONCURRENT', milestone: 'M0', dependencies: [], verification: [], evidence: [] });
    fs.writeFileSync(featureListPath, JSON.stringify(concurrent, null, 2) + '\n');
    return spawnSync(...args);
  };

  const result = runVerify(dir, 'M0-FEAT-001', { exec });
  assert.equal(result.ok, true);

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  const ids = saved.features.map((f) => f.id).sort();
  assert.deepEqual(ids, ['M0-FEAT-001', 'M0-FEAT-CONCURRENT']);
  assert.equal(saved.features[0].evidence.length, 1);
});

test('verify refuses to run when another owner actively holds the claim, even in solo mode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, [{ type: 'automated', command: NODE_TRUE, expected: 'exit 0' }]);

  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features[0].claim = {
    id: 'x', owner: 'someone-else', actor_id: 'someone-else',
    claimed_at: new Date().toISOString(), lease_until: new Date(Date.now() + 60_000).toISOString(),
  };
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');

  assert.throws(() => runVerify(dir, 'M0-FEAT-001'), /currently claimed by "someone-else"/);

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  assert.equal(saved.features[0].evidence.length, 0);
});

test('verify requires an active claim in team mode and does not auto-release it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ collaborationMode: 'team' }));
  const featureListPath = seedRepo(dir, [{ type: 'automated', command: NODE_TRUE, expected: 'exit 0' }]);

  assert.throws(() => runVerify(dir, 'M0-FEAT-001'), /must have an active claim/);

  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features[0].claim = {
    id: 'team-claim', owner: 'agent', actor_id: 'agent',
    claimed_at: new Date().toISOString(), lease_until: new Date(Date.now() + 60_000).toISOString(),
  };
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');

  const result = runVerify(dir, 'M0-FEAT-001');
  assert.equal(result.ok, true);

  // No claim/release events in team mode — verify only ever wrote its own
  // feature.verified event.
  const monthKey = new Date().toISOString().slice(0, 7);
  const events = readEvents(dir, monthKey);
  assert.deepEqual(events.map((e) => e.type), ['feature.verified']);

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  assert.equal(saved.features[0].claim.id, 'team-claim');
});

test('verify refuses manual verification before executing any command', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, [
    { type: 'automated', command: NODE_TRUE, expected: 'exit 0' },
    { type: 'manual', command: 'Confirm the UI looks correct', expected: 'UI is correct' },
  ]);
  let executions = 0;
  assert.throws(
    () => runVerify(dir, 'M0-FEAT-001', { exec: () => { executions += 1; return { status: 0 }; } }),
    /contains manual verification/,
  );
  assert.equal(executions, 0);
});

test('verify in solo mode does not release a claim that already existed before this call', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir, [{ type: 'automated', command: NODE_TRUE, expected: 'exit 0' }]);

  const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  data.features[0].claim = {
    id: 'x', owner: 'agent', actor_id: 'agent',
    claimed_at: new Date().toISOString(), lease_until: new Date(Date.now() + 60_000).toISOString(),
  };
  fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');

  runVerify(dir, 'M0-FEAT-001');

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  assert.equal(saved.features[0].claim.id, 'x');
});
