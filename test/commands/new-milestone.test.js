import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { runNewMilestone } from '../../src/commands/new-milestone.js';

function scriptedInput(lines) {
  return Readable.from([lines.join('\n') + '\n']);
}

function nullOutput() {
  return new Writable({ write(chunk, enc, cb) { cb(); } });
}

test('new-milestone appends a schema-valid entry from scripted answers', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }], features: [],
  }));

  const input = scriptedInput(['M1', 'Second milestone', 'Ship the second slice']);
  const milestone = await runNewMilestone(dir, { input, output: nullOutput() });

  assert.deepEqual(milestone, { id: 'M1', title: 'Second milestone', objective: 'Ship the second slice' });

  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(saved.milestones.length, 2);
});
