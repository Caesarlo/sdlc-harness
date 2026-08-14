import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runStatus } from '../../src/commands/status.js';

test('status summarizes counts and the active feature', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const data = {
    project: 'demo',
    milestones: [{ id: 'M0' }, { id: 'M1' }],
    features: [
      { id: 'A', status: 'passing' },
      { id: 'B', status: 'in_progress', title: 'Do the thing', behavior: 'thing happens' },
      { id: 'C', status: 'not_started' },
      { id: 'D', status: 'blocked' },
    ],
  };
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify(data));

  const status = runStatus(dir);
  assert.equal(status.project, 'demo');
  assert.deepEqual(status.counts, { not_started: 1, in_progress: 1, blocked: 1, passing: 1 });
  assert.deepEqual(status.activeFeatures, [{ id: 'B', title: 'Do the thing', behavior: 'thing happens', owner: null }]);
  assert.deepEqual(status.readyFeatures.map((f) => f.id), ['C']);
  assert.deepEqual(status.blockedFeatures.map((f) => f.id), ['D']);
  assert.match(status.nextActions[0], /Continue B/);
  assert.equal(status.milestoneCount, 2);
});

test('status reports an empty activeFeatures array when nothing is in_progress', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const data = { project: 'demo', milestones: [{ id: 'M0' }], features: [{ id: 'A', status: 'not_started' }] };
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify(data));

  assert.deepEqual(runStatus(dir).activeFeatures, []);
  assert.match(runStatus(dir).nextActions[0], /feature start A/);
});
