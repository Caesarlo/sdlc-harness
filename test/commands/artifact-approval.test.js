import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordArtifactApproval, listArtifactApprovals } from '../../src/commands/artifact-approval.js';
import { validateArtifactApprovals } from '../../src/validators/artifact-approval.js';
import { readEvents } from '../../src/lib/events.js';

test('artifact approval is append-only evidence bound to the current file hash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.mkdirSync(path.join(dir, 'docs', 'product'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'product', 'requirements.md'), '# Requirements\n');
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [], features: [], evidence: [],
  }));

  const evidence = recordArtifactApproval(dir, 'docs/product/requirements.md', {
    actor: 'human:owner', summary: 'Scope is correct',
  });
  assert.equal(evidence.kind, 'approval');
  assert.equal(evidence.result, 'approved');
  assert.match(evidence.content_hash, /^sha256:[a-f0-9]{64}$/);

  const data = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(data.evidence.length, 1);
  assert.equal(listArtifactApprovals(dir, data)[0].valid, true);
  assert.equal(validateArtifactApprovals(data, dir).ok, true);

  const events = readEvents(dir, new Date().toISOString().slice(0, 7));
  assert.equal(events[0].type, 'artifact.approved');
});

test('artifact approval becomes stale when approved content changes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.mkdirSync(path.join(dir, 'docs', 'product'), { recursive: true });
  const artifact = path.join(dir, 'docs', 'product', 'requirements.md');
  fs.writeFileSync(artifact, '# Requirements\n');
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [], features: [],
  }));
  recordArtifactApproval(dir, 'docs/product/requirements.md', {
    actor: 'human:owner', summary: 'Approved',
  });
  fs.appendFileSync(artifact, '\nChanged after approval.\n');

  const data = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(listArtifactApprovals(dir, data)[0].valid, false);
  assert.match(validateArtifactApprovals(data, dir).errors[0], /stale/);
});
