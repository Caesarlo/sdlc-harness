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

test('cli --help succeeds and documents every top-level command group', () => {
  const output = execFileSync('node', [CLI, '--help'], { stdio: 'pipe' }).toString();
  for (const command of ['feature', 'review', 'evidence', 'provider', 'workspace', 'traceability']) {
    assert.match(output, new RegExp(command));
  }
});

test('each subcommand supports -h and --help with a zero exit code', () => {
  const commands = [
    'init', 'adopt', 'validate', 'status', 'traceability', 'new-feature', 'new-milestone',
    'milestone', 'feature', 'verify', 'review', 'claim', 'release', 'workspace', 'provider',
    'evidence', 'env', 'session', 'feedback',
  ];
  for (const command of commands) {
    for (const flag of ['-h', '--help']) {
      const output = execFileSync('node', [CLI, command, flag], { stdio: 'pipe' }).toString();
      assert.match(output, /Usage:/, `${command} ${flag} should print a Usage: line`);
    }
  }
});

test('-h after a subcommand and its arguments still shows help instead of running the command', () => {
  const output = execFileSync('node', [CLI, 'feature', 'start', 'M0-FEAT-001', '-h'], { stdio: 'pipe' }).toString();
  assert.match(output, /Usage:/);
});
