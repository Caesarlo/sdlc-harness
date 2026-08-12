import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeNew, writeIfMissing } from '../../src/lib/fs-safe.js';

test('writeNew creates parent dirs and writes content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const target = path.join(dir, 'nested', 'file.txt');
  const result = writeNew(target, 'hello');
  assert.equal(result.action, 'written');
  assert.equal(fs.readFileSync(target, 'utf8'), 'hello');
});

test('writeIfMissing skips existing files without modifying them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const target = path.join(dir, 'file.txt');
  fs.writeFileSync(target, 'original');
  const result = writeIfMissing(target, 'new content');
  assert.equal(result.action, 'skipped-exists');
  assert.equal(fs.readFileSync(target, 'utf8'), 'original');
});

test('writeIfMissing writes when file does not exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const target = path.join(dir, 'file.txt');
  const result = writeIfMissing(target, 'new content');
  assert.equal(result.action, 'written');
  assert.equal(fs.readFileSync(target, 'utf8'), 'new content');
});
