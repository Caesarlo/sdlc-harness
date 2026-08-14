import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordFeedback } from '../../src/commands/feedback.js';
import { readEvents } from '../../src/lib/events.js';

test('recordFeedback creates the log with a well-formed entry when none exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const entry = recordFeedback(dir, {
    source: 'NFR-3', severity: 'S2', observation: 'p95 latency hit 480ms', disposition: 'Actioned', detail: 'opened FEAT-9',
  });
  assert.equal(entry.severity, 'S2');

  const content = fs.readFileSync(path.join(dir, 'docs', 'product', 'feedback-log.md'), 'utf8');
  assert.match(content, /\*\*Source\*\*: NFR-3/);
  assert.match(content, /\*\*Severity\*\*: S2/);
  assert.match(content, /\*\*Disposition\*\*: Actioned — opened FEAT-9/);

  const monthKey = new Date().toISOString().slice(0, 7);
  const events = readEvents(dir, monthKey);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'feedback.logged');
});

test('recordFeedback prepends new entries (newest first)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  recordFeedback(dir, {
    source: 'first', severity: 'S4', observation: 'a', disposition: 'Monitoring',
  });
  recordFeedback(dir, {
    source: 'second', severity: 'S3', observation: 'b', disposition: 'Monitoring',
  });

  const content = fs.readFileSync(path.join(dir, 'docs', 'product', 'feedback-log.md'), 'utf8');
  assert.ok(content.indexOf('**Source**: second') < content.indexOf('**Source**: first'));
});

test('recordFeedback rejects an unrecognized severity or disposition', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  assert.throws(() => recordFeedback(dir, {
    source: 'x', severity: 'S9', observation: 'a', disposition: 'Monitoring',
  }), /Severity must be one of/);
  assert.throws(() => recordFeedback(dir, {
    source: 'x', severity: 'S1', observation: 'a', disposition: 'Ignored',
  }), /Disposition must be one of/);
});

test('recordFeedback requires a detail for Deferred and Declined', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  assert.throws(() => recordFeedback(dir, {
    source: 'x', severity: 'S3', observation: 'a', disposition: 'Deferred',
  }), /requires --detail/);
  assert.throws(() => recordFeedback(dir, {
    source: 'x', severity: 'S3', observation: 'a', disposition: 'Declined',
  }), /requires --detail/);

  // Monitoring/Actioned don't require it.
  recordFeedback(dir, {
    source: 'x', severity: 'S3', observation: 'a', disposition: 'Monitoring',
  });
});
