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
