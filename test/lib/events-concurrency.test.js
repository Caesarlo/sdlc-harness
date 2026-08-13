import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readEvents } from '../../src/lib/events.js';

const EVENTS_MODULE_URL = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'lib', 'events.js'),
).href;

function spawnAppender(dir, actorIndex, count) {
  return new Promise((resolve, reject) => {
    const script = `
      import { appendEvent } from ${JSON.stringify(EVENTS_MODULE_URL)};
      for (let i = 0; i < ${count}; i++) {
        appendEvent(${JSON.stringify(dir)}, { type: 'stress.append', actor_index: ${actorIndex}, i });
      }
    `;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script]);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`child ${actorIndex} exited with ${code}: ${stderr}`))));
  });
}

// Real cross-process concurrency (not just concurrent Promises in one
// process): multiple separate Node processes appendEvent-ing into the same
// month file at once. appendFileSync's append-flag write is only guaranteed
// atomic under PIPE_BUF on POSIX; Windows doesn't give the same cross-process
// guarantee, which is why events.js keeps each line small and single-object.
// This test is the actual empirical check for that, not just documentation.
test('concurrent appendEvent calls from multiple real OS processes never corrupt or interleave lines', { timeout: 30_000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-events-stress-'));
  const PROCESSES = 6;
  const PER_PROCESS = 15;
  const TOTAL = PROCESSES * PER_PROCESS;

  await Promise.all(Array.from({ length: PROCESSES }, (_, i) => spawnAppender(dir, i, PER_PROCESS)));

  const monthKey = new Date().toISOString().slice(0, 7);
  const filePath = path.join(dir, '.harness', 'events', `${monthKey}.jsonl`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  assert.equal(lines.length, TOTAL, 'no line was dropped or merged with another');

  // A corrupted/interleaved write produces a line that fails to parse — this
  // is the actual corruption check, not just a count check.
  const events = lines.map((line) => JSON.parse(line));
  assert.equal(events.length, TOTAL);

  const ids = new Set(events.map((e) => e.event_id));
  assert.equal(ids.size, TOTAL, 'every event_id must be unique across processes');

  const byActor = new Map();
  for (const e of events) {
    if (!byActor.has(e.actor_index)) byActor.set(e.actor_index, new Set());
    byActor.get(e.actor_index).add(e.i);
  }
  assert.equal(byActor.size, PROCESSES);
  for (const seenIs of byActor.values()) {
    assert.equal(seenIs.size, PER_PROCESS, 'every process\'s events must all be present, none dropped');
  }

  assert.equal(readEvents(dir, monthKey).length, TOTAL);
});
