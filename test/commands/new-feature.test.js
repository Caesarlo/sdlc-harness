import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { runNewFeature } from '../../src/commands/new-feature.js';

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
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }], features: [],
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
  ]);

  const feature = await runNewFeature(dir, { input, output: nullOutput() });

  assert.equal(feature.id, 'M0-FEAT-002');
  assert.equal(feature.status, 'not_started');
  assert.deepEqual(feature.dependencies, []);
  assert.deepEqual(feature.evidence, []);
  assert.equal(feature.verification[0].command, 'npm test -- widget');

  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(saved.features.length, 1);
  assert.equal(saved.features[0].id, 'M0-FEAT-002');
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

test('new-feature retries once and preserves a concurrent writer\'s change instead of clobbering it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const featureListPath = path.join(dir, 'feature_list.json');
  fs.writeFileSync(featureListPath, JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }], features: [],
  }));

  const lines = [
    'M0-FEAT-002', 'M0', 'Add widget', 'user can add a widget', '',
    'npm test -- widget', '', 'docs/adr/0001-widgets.md',
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
