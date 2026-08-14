import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runEnvCheck } from '../../src/lib/env-check.js';

function seedRepo(dir, commands = {}) {
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ commands }));
}

function fakeExec(script) {
  return (command) => script(command);
}

test('runEnvCheck reports nothing configured when commands is empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, {});
  const result = runEnvCheck(dir, { exec: fakeExec(() => { throw new Error('should not run'); }) });
  assert.equal(result.configured, false);
  assert.equal(result.ok, true);
  assert.deepEqual(result.results, []);
});

test('runEnvCheck runs configured commands in bootstrap/verify/e2e/health order and stops at first failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, {
    health: 'echo health', bootstrap: 'echo bootstrap', verify: 'echo verify', e2e: 'echo e2e',
  });
  const calls = [];
  const exec = fakeExec((command) => {
    calls.push(command);
    if (command === 'echo verify') return { status: 1, stdout: '', stderr: 'boom' };
    return { status: 0, stdout: 'ok', stderr: '' };
  });

  const result = runEnvCheck(dir, { exec });
  assert.equal(result.configured, true);
  assert.equal(result.ok, false);
  // bootstrap ran and passed, verify ran and failed, e2e/health never ran.
  assert.deepEqual(calls, ['echo bootstrap', 'echo verify']);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].passed, true);
  assert.equal(result.results[1].passed, false);
});

test('runEnvCheck succeeds when every configured command exits 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { bootstrap: 'echo ok', health: 'echo ok' });
  const exec = fakeExec(() => ({ status: 0, stdout: 'ok', stderr: '' }));

  const result = runEnvCheck(dir, { exec });
  assert.equal(result.ok, true);
  assert.equal(result.results.length, 2);
  assert.ok(result.results.every((r) => r.passed));
});

test('runEnvCheck skips start and cleanup — those are not pass/fail checks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { start: 'npm run dev', cleanup: 'rm -rf tmp' });
  const exec = fakeExec(() => { throw new Error('should not run start/cleanup'); });

  const result = runEnvCheck(dir, { exec });
  assert.equal(result.configured, false);
  assert.equal(result.ok, true);
});
