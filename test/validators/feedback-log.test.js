import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateFeedbackLog } from '../../src/validators/feedback-log.js';
import { recordFeedback } from '../../src/commands/feedback.js';

function writeLog(dir, content) {
  const logPath = path.join(dir, 'docs', 'product', 'feedback-log.md');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, content, 'utf8');
}

test('passes trivially when the log does not exist yet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  assert.deepEqual(validateFeedbackLog(dir, { observabilityMode: 'feedback-only' }), { ok: true, errors: [] });
});

test('skips entirely when observabilityMode is none, even with a malformed log', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeLog(dir, '- **Date**: 2026-01-01\n  **Source**: x\n');
  assert.deepEqual(validateFeedbackLog(dir, { observabilityMode: 'none' }), { ok: true, errors: [] });
});

test('passes on entries written by recordFeedback', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  recordFeedback(dir, {
    source: 'NFR-3', severity: 'S2', observation: 'latency spike', disposition: 'Deferred', detail: 'waiting on infra ticket',
  });
  const result = validateFeedbackLog(dir, { observabilityMode: 'feedback-only' });
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('rejects an entry missing Disposition', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeLog(dir, [
    '# Feedback Log', '',
    '- **Date**: 2026-01-01',
    '  **Source**: manual smoke test',
    '  **Severity**: S3',
    '  **Observation**: checkout button flickers',
    '',
  ].join('\n'));

  const result = validateFeedbackLog(dir, { observabilityMode: 'feedback-only' });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /missing Disposition/);
});

test('rejects an unrecognized Severity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeLog(dir, [
    '# Feedback Log', '',
    '- **Date**: 2026-01-01',
    '  **Source**: x',
    '  **Severity**: URGENT',
    '  **Observation**: y',
    '  **Disposition**: Monitoring',
    '',
  ].join('\n'));

  const result = validateFeedbackLog(dir, { observabilityMode: 'feedback-only' });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /must be one of S1, S2, S3, S4/);
});

test('rejects a Deferred/Declined entry with no stated reason', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeLog(dir, [
    '# Feedback Log', '',
    '- **Date**: 2026-01-01',
    '  **Source**: x',
    '  **Severity**: S3',
    '  **Observation**: y',
    '  **Disposition**: Deferred',
    '',
  ].join('\n'));

  const result = validateFeedbackLog(dir, { observabilityMode: 'feedback-only' });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /must state why/);
});
