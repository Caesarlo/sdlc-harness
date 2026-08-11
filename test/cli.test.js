import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.js');

test('cli with no command prints usage and exits non-zero', () => {
  assert.throws(() => {
    execFileSync('node', [CLI], { stdio: 'pipe' });
  }, (err) => {
    assert.equal(err.status, 1);
    assert.match(err.stderr.toString(), /Usage: sdlc-harness/);
    return true;
  });
});
