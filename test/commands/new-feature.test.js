import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { runNewFeature, runNewFeatureFromFile } from '../../src/commands/new-feature.js';
import { readEvents } from '../../src/lib/events.js';

function scriptedInput(lines) {
  return Readable.from([lines.join('\n') + '\n']);
}

function nullOutput() {
  return new Writable({ write(chunk, enc, cb) { cb(); } });
}

// Delivers each line one at a time (instead of one buffered chunk), running
// `hook` synchronously right before the line at `hookIndex` is delivered —
// lets a test simulate a concurrent writer landing mid-prompt.
function scriptedInputWithHook(lines, hookIndex, hook) {
  let i = 0;
  return new Readable({
    read() {
      if (i >= lines.length) {
        this.push(null);
        return;
      }
      if (i === hookIndex) hook();
      this.push(lines[i] + '\n');
      i += 1;
    },
  });
}

test('new-feature appends a schema-valid entry from scripted answers', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'M0', objective: 'Deliver M0' }], features: [],
  }));
  const input = scriptedInput([
    'M0-FEAT-002',       // id
    'M0',                // milestone
    'Add widget',        // title
    'user can add a widget', // behavior
    '',                    // owner
    'npm test -- widget', // verification command
    '',                   // dependencies
    'docs/adr/0001-widgets.md', // source refs
    '5',                   // priority
  ]);

  const feature = await runNewFeature(dir, { input, output: nullOutput() });

  assert.equal(feature.id, 'M0-FEAT-002');
  assert.equal(feature.status, 'not_started');
  assert.deepEqual(feature.dependencies, []);
  assert.deepEqual(feature.evidence, []);
  assert.equal(feature.verification[0].command, 'npm test -- widget');
  assert.equal(feature.priority, 5);

  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(saved.features.length, 1);
  assert.equal(saved.features[0].id, 'M0-FEAT-002');

  const monthKey = new Date().toISOString().slice(0, 7);
  const events = readEvents(dir, monthKey);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'feature.created');
  assert.equal(events[0].feature_id, 'M0-FEAT-002');
});

test('new-feature rejects a duplicate id', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }],
    features: [{ id: 'M0-FEAT-001', milestone: 'M0', dependencies: [], verification: [] }],
  }));

  const input = scriptedInput(['M0-FEAT-001']);
  await assert.rejects(() => runNewFeature(dir, { input, output: nullOutput() }), /already exists/);
});

test('new-feature creates a feature non-interactively from a repository JSON file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'M0', objective: 'Deliver M0' }], features: [],
  }));
  fs.mkdirSync(path.join(dir, 'docs', 'product'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'product', 'requirements.md'), '- **FR-1**: requirement\n');
  fs.writeFileSync(path.join(dir, 'feature.json'), JSON.stringify({
    id: 'M0-FEAT-API',
    milestone: 'M0',
    title: 'Agent-created feature',
    behavior: 'An observable outcome exists',
    dependencies: [],
    verification: [{ type: 'automated', command: 'npm test', expected: 'passes' }],
    source_refs: ['docs/product/requirements.md#FR-1'],
  }));

  const feature = runNewFeatureFromFile(dir, 'feature.json');
  assert.equal(feature.id, 'M0-FEAT-API');
  assert.equal(feature.status, 'not_started');
  assert.deepEqual(feature.evidence, []);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(saved.features[0].id, 'M0-FEAT-API');
});

test('new-feature input cannot inject lifecycle state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }], features: [],
  }));
  fs.writeFileSync(path.join(dir, 'feature.json'), JSON.stringify({
    id: 'M0-FEAT-BAD', milestone: 'M0', behavior: 'bad', status: 'passing',
    verification: [{ type: 'automated', command: 'true', expected: 'passes' }],
  }));
  assert.throws(() => runNewFeatureFromFile(dir, 'feature.json'), /must have status "not_started"/);
});

test('new-feature input is validated before mutation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'M0', objective: 'Deliver M0' }], features: [],
  }));
  fs.writeFileSync(path.join(dir, 'feature.json'), JSON.stringify({
    id: 'M0-FEAT-BAD-REF', milestone: 'M0', behavior: 'bad ref',
    verification: [{ type: 'automated', command: 'true', expected: 'passes' }],
    source_refs: ['docs/product/missing.md#FR-1'],
  }));

  assert.throws(() => runNewFeatureFromFile(dir, 'feature.json'), /\[stage-gate\]/);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.deepEqual(saved.features, []);
});

test('new-feature retries once and preserves a concurrent writer\'s change instead of clobbering it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = path.join(dir, 'feature_list.json');
  fs.writeFileSync(featureListPath, JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }], features: [],
  }));

  const lines = [
    'M0-FEAT-002', 'M0', 'Add widget', 'user can add a widget', '',
    'npm test -- widget', '', 'docs/adr/0001-widgets.md', '',
  ];
  const input = scriptedInputWithHook(lines, lines.length - 1, () => {
    // Simulate another process (a second Agent/developer) landing a write
    // in between our read and our write.
    const concurrent = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
    concurrent.features.push({
      id: 'M0-FEAT-CONCURRENT', milestone: 'M0', dependencies: [], verification: [],
    });
    fs.writeFileSync(featureListPath, JSON.stringify(concurrent, null, 2) + '\n');
  });

  const feature = await runNewFeature(dir, { input, output: nullOutput() });
  assert.equal(feature.id, 'M0-FEAT-002');

  const saved = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
  const ids = saved.features.map((f) => f.id).sort();
  assert.deepEqual(ids, ['M0-FEAT-002', 'M0-FEAT-CONCURRENT']);
});
