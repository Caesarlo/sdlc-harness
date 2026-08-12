import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.js');

test('init then validate then status succeed end-to-end via the CLI binary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));

  const initOut = execFileSync('node', [CLI, 'init'], { cwd: dir }).toString();
  assert.match(initOut, /Wrote \d+ files\./);

  const validateOut = execFileSync('node', [CLI, 'validate'], { cwd: dir }).toString();
  assert.match(validateOut, /All checks passed\./);

  const statusOut = execFileSync('node', [CLI, 'status'], { cwd: dir }).toString();
  const status = JSON.parse(statusOut);
  assert.equal(status.counts.not_started, 1);
  assert.equal(status.milestoneCount, 1);

  assert.equal(fs.existsSync(path.join(dir, '.claude', 'skills', 'requirements', 'SKILL.md')), true);
});

test('adopt on a directory with an existing AGENTS.md reports it as skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM');

  const adoptOut = execFileSync('node', [CLI, 'adopt'], { cwd: dir }).toString();
  assert.match(adoptOut, /skipped 1 existing files?/);
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'CUSTOM');
});

test('new-feature with a duplicate id exits non-zero with a clean error, not a raw stack trace', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }],
    features: [{ id: 'M0-FEAT-001', milestone: 'M0', dependencies: [], verification: [] }],
  }));

  let threw = false;
  try {
    execFileSync('node', [CLI, 'new-feature'], { cwd: dir, input: 'M0-FEAT-001\n' });
  } catch (err) {
    threw = true;
    assert.notEqual(err.status, 0);
    const stderr = err.stderr.toString();
    assert.match(stderr, /Feature id already exists: M0-FEAT-001/);
    assert.doesNotMatch(stderr, /UnhandledPromiseRejection/);
    assert.doesNotMatch(stderr, /at\s+\S+\s+\(.*:\d+:\d+\)/);
  }
  assert.equal(threw, true);
});
