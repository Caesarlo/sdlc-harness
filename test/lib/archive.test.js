import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  archiveMilestone, listArchivedMilestones, loadArchivedFeatureIds, loadArchivedFeatures,
  MilestoneNotFoundError, MilestoneNotArchivableError, MilestoneAlreadyArchivedError,
} from '../../src/lib/archive.js';
import { readEvents } from '../../src/lib/events.js';
import { listReadyFeatures } from '../../src/lib/claims.js';

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-archive-'));
  return dir;
}

function writeFeatureList(dir, data) {
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify(data, null, 2));
}

function passingFeature(overrides = {}) {
  return {
    id: 'M0-FEAT-001',
    milestone: 'M0',
    status: 'passing',
    dependencies: [],
    verification: [{ type: 'automated', command: 'true', expected: '' }],
    evidence: [{ kind: 'review', result: 'passed' }],
    ...overrides,
  };
}

test('archives a fully-passing milestone into .harness/archive/ and removes it from feature_list.json', () => {
  const dir = tmpRepo();
  writeFeatureList(dir, {
    project: 'demo',
    schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'Bootstrap' }, { id: 'M1', title: 'Next' }],
    features: [passingFeature(), passingFeature({ id: 'M0-FEAT-002' })],
  });

  const record = archiveMilestone(dir, 'M0', { actor: 'ganjiaxin' });

  assert.equal(record.features.length, 2);
  assert.equal(record.archived_by, 'ganjiaxin');
  assert.ok(fs.existsSync(path.join(dir, '.harness', 'archive', 'M0.json')));

  const remaining = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.deepEqual(remaining.milestones.map((m) => m.id), ['M1']);
  assert.equal(remaining.features.length, 0);

  const events = readEvents(dir, new Date().toISOString().slice(0, 7));
  assert.equal(events.at(-1).type, 'milestone.archived');
  assert.equal(events.at(-1).milestone_id, 'M0');
});

test('refuses to archive a milestone with a non-passing feature', () => {
  const dir = tmpRepo();
  writeFeatureList(dir, {
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }],
    features: [passingFeature(), passingFeature({ id: 'M0-FEAT-002', status: 'in_progress' })],
  });

  assert.throws(() => archiveMilestone(dir, 'M0'), MilestoneNotArchivableError);
  assert.equal(fs.existsSync(path.join(dir, '.harness', 'archive', 'M0.json')), false);
  const untouched = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(untouched.features.length, 2);
});

test('throws for an unknown milestone id', () => {
  const dir = tmpRepo();
  writeFeatureList(dir, { project: 'demo', schema_version: '1.0', milestones: [], features: [] });
  assert.throws(() => archiveMilestone(dir, 'M9'), MilestoneNotFoundError);
});

test('refuses to archive the same milestone twice', () => {
  const dir = tmpRepo();
  writeFeatureList(dir, {
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }], features: [passingFeature()],
  });
  archiveMilestone(dir, 'M0');
  assert.throws(() => archiveMilestone(dir, 'M0'), MilestoneAlreadyArchivedError);
});

test('archived feature ids satisfy dependencies for new-milestone work', () => {
  const dir = tmpRepo();
  writeFeatureList(dir, {
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }], features: [passingFeature()],
  });
  archiveMilestone(dir, 'M0');

  const archivedIds = loadArchivedFeatureIds(dir);
  assert.deepEqual([...archivedIds], ['M0-FEAT-001']);
  assert.equal(loadArchivedFeatures(dir).length, 1);

  const data = {
    features: [{
      id: 'M1-FEAT-001', milestone: 'M1', status: 'not_started', dependencies: ['M0-FEAT-001'],
    }],
  };
  const ready = listReadyFeatures(data, archivedIds);
  assert.deepEqual(ready.map((f) => f.id), ['M1-FEAT-001']);
});

test('listArchivedMilestones returns an empty array when nothing has been archived', () => {
  const dir = tmpRepo();
  assert.deepEqual(listArchivedMilestones(dir), []);
});
