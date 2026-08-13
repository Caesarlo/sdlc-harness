import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runEvidenceImport, CiRunNotVerifiableError, CiRunNotSuccessfulError, FeatureNotFoundError,
} from '../../src/commands/evidence-import.js';
import { readEvents } from '../../src/lib/events.js';

function seedRepo(dir) {
  const featureListPath = path.join(dir, 'feature_list.json');
  fs.writeFileSync(featureListPath, JSON.stringify({
    project: 'demo', schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features: [{
      id: 'M0-FEAT-001', milestone: 'M0', behavior: 'a', status: 'in_progress',
      dependencies: [], verification: [], evidence: [],
    }],
  }));
  return featureListPath;
}

function mockGh(response) {
  return () => response;
}

test('runEvidenceImport accepts a verified successful run and records real evidence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);

  const runGh = mockGh({
    status: 0,
    stdout: JSON.stringify({
      status: 'completed', conclusion: 'success', head_sha: 'abc123',
      name: 'ci', html_url: 'https://github.com/acme/widgets/actions/runs/42',
    }),
  });

  const evidence = runEvidenceImport(dir, 'M0-FEAT-001', { owner: 'acme', repo: 'widgets', runId: 42, runGh });
  assert.equal(evidence.kind, 'test');
  assert.equal(evidence.result, 'passed');
  assert.equal(evidence.commit_sha, 'abc123');
  assert.equal(evidence.ci.run_id, '42');
  assert.equal(evidence.ci.provider, 'github');

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  assert.equal(saved.features[0].evidence.length, 1);
  assert.deepEqual(saved.features[0].evidence[0], evidence);

  const monthKey = new Date().toISOString().slice(0, 7);
  const events = readEvents(dir, monthKey);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'evidence.imported');
});

test('runEvidenceImport refuses a run the provider says failed, even if the caller claims otherwise', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);

  const runGh = mockGh({
    status: 0,
    stdout: JSON.stringify({ status: 'completed', conclusion: 'failure', head_sha: 'abc123' }),
  });

  assert.throws(() => runEvidenceImport(dir, 'M0-FEAT-001', { owner: 'acme', repo: 'widgets', runId: 42, runGh }), CiRunNotSuccessfulError);

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  assert.equal(saved.features[0].evidence.length, 0);
});

test('runEvidenceImport refuses a run still in progress', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir);

  const runGh = mockGh({
    status: 0,
    stdout: JSON.stringify({ status: 'in_progress', conclusion: null, head_sha: 'abc123' }),
  });

  assert.throws(() => runEvidenceImport(dir, 'M0-FEAT-001', { owner: 'acme', repo: 'widgets', runId: 42, runGh }), CiRunNotSuccessfulError);
});

test('runEvidenceImport refuses a run id that the provider says does not exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = seedRepo(dir);

  const runGh = mockGh({ status: 1, stderr: 'gh: Not Found (HTTP 404)' });

  assert.throws(() => runEvidenceImport(dir, 'M0-FEAT-001', { owner: 'acme', repo: 'widgets', runId: 999999, runGh }), CiRunNotVerifiableError);

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  assert.equal(saved.features[0].evidence.length, 0);
});

test('runEvidenceImport throws FeatureNotFoundError for an unknown feature, without ever calling the provider needlessly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir);

  const runGh = mockGh({
    status: 0,
    stdout: JSON.stringify({ status: 'completed', conclusion: 'success', head_sha: 'abc123' }),
  });

  assert.throws(() => runEvidenceImport(dir, 'NOPE', { owner: 'acme', repo: 'widgets', runId: 42, runGh }), FeatureNotFoundError);
});
