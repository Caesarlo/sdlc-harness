import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendEvent, readEvents } from '../../src/lib/events.js';

test('appendEvent writes a single JSON line with an id, timestamp, and actor', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const record = appendEvent(dir, { type: 'feature.created', feature_id: 'M0-FEAT-001' });

  assert.ok(record.event_id);
  assert.ok(record.timestamp);
  assert.ok(record.actor);
  assert.equal(record.type, 'feature.created');
  assert.equal(record.feature_id, 'M0-FEAT-001');

  const monthKey = record.timestamp.slice(0, 7);
  const events = readEvents(dir, monthKey);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], record);
});

test('appendEvent accumulates multiple events in the same month file, one per line', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const first = appendEvent(dir, { type: 'feature.created', feature_id: 'A' });
  appendEvent(dir, { type: 'feature.created', feature_id: 'B' });
  appendEvent(dir, { type: 'feature.verified', feature_id: 'A', ok: true });

  const monthKey = first.timestamp.slice(0, 7);
  const events = readEvents(dir, monthKey);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((e) => e.type), ['feature.created', 'feature.created', 'feature.verified']);

  const raw = fs.readFileSync(path.join(dir, '.harness', 'events', `${monthKey}.jsonl`), 'utf8');
  assert.equal(raw.split('\n').filter((l) => l.trim()).length, 3);
});

test('readEvents returns an empty array for a month with no events', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  assert.deepEqual(readEvents(dir, '2020-01'), []);
});

test('each event gets a unique event_id even when appended in quick succession', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const records = Array.from({ length: 20 }, (_, i) => appendEvent(dir, { type: 'feature.created', feature_id: `F${i}` }));
  const ids = new Set(records.map((r) => r.event_id));
  assert.equal(ids.size, 20);
});
