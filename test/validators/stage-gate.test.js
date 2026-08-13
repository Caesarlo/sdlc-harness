import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateStageGate } from '../../src/validators/stage-gate.js';

test('skips placeholder features entirely', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const data = { features: [{ id: 'M2-SCOPE-001', source_refs: [] }] };
  assert.deepEqual(validateStageGate(data, dir), { ok: true, errors: [] });
});

test('rejects a feature with no source_refs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const data = { features: [{ id: 'M0-FEAT-001', source_refs: [] }] };
  const result = validateStageGate(data, dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /has no source_refs/);
});

test('rejects a source_ref that does not resolve to a file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const data = { features: [{ id: 'M0-FEAT-001', source_refs: ['docs/adr/0001-missing.md'] }] };
  const result = validateStageGate(data, dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /does not resolve to a file/);
});

test('rejects a source_ref that escapes the repo root via ../', () => {
  const outerFile = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-outer-'));
  fs.writeFileSync(path.join(outerFile, 'secret.md'), '# secret');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const escapePath = path.relative(dir, path.join(outerFile, 'secret.md')).split(path.sep).join('/');
  const data = { features: [{ id: 'M0-FEAT-001', source_refs: [escapePath] }] };
  const result = validateStageGate(data, dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /does not resolve to a file inside the repo/);
});

test('rejects an absolute path as a source_ref', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  const absoluteOutside = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-abs-'));
  fs.writeFileSync(path.join(absoluteOutside, 'x.md'), '# x');
  const data = { features: [{ id: 'M0-FEAT-001', source_refs: [path.join(absoluteOutside, 'x.md')] }] };
  const result = validateStageGate(data, dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /does not resolve to a file inside the repo/);
});

test('accepts a source_ref that resolves, including a #fragment', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.mkdirSync(path.join(dir, 'docs', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'adr', '0001-auth.md'), '# ADR');
  const data = { features: [{ id: 'M0-FEAT-001', source_refs: ['docs/adr/0001-auth.md#decision'] }] };
  assert.deepEqual(validateStageGate(data, dir), { ok: true, errors: [] });
});
