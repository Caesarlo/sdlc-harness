import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveSafeRepoPath } from '../../src/lib/safe-path.js';

test('resolveSafeRepoPath accepts a ref that resolves inside the repo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.writeFileSync(path.join(dir, 'docs', 'a.md'), '# a');
  assert.equal(resolveSafeRepoPath(dir, 'docs/a.md'), fs.realpathSync(path.join(dir, 'docs', 'a.md')));
});

test('resolveSafeRepoPath rejects a ../ escape', () => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-outer-'));
  fs.writeFileSync(path.join(outer, 'secret.md'), '# secret');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const escapePath = path.relative(dir, path.join(outer, 'secret.md')).split(path.sep).join('/');
  assert.equal(resolveSafeRepoPath(dir, escapePath), null);
});

test('resolveSafeRepoPath rejects an absolute path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-outer-'));
  fs.writeFileSync(path.join(outer, 'x.md'), '# x');
  assert.equal(resolveSafeRepoPath(dir, path.join(outer, 'x.md')), null);
});

test('resolveSafeRepoPath rejects a NUL byte', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  assert.equal(resolveSafeRepoPath(dir, 'docs/a.md\0.png'), null);
});

test('resolveSafeRepoPath returns null for a ref that does not exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  assert.equal(resolveSafeRepoPath(dir, 'docs/missing.md'), null);
});

// Windows-only: an 8.3 "short name" alias (e.g. LONGDI~1) can reach the same
// file as its long name. If containment were checked only against the
// literal long-name path, a ref built from a sibling repo's short name could
// resolve outside the repo root without ever containing "..". realpath
// normalizes short names to their long form, which is what actually closes
// this — this test proves that empirically rather than assuming it.
function findShortName(parentDir, longName) {
  let output;
  try {
    output = execFileSync('cmd', ['/c', 'dir', '/x', parentDir], { encoding: 'utf8' });
  } catch {
    return null;
  }
  for (const line of output.split('\n')) {
    if (!line.includes(longName)) continue;
    const tokens = line.trim().split(/\s+/);
    const longIdx = tokens.lastIndexOf(longName);
    if (longIdx > 0) {
      const candidate = tokens[longIdx - 1];
      if (candidate && candidate !== longName && /~/.test(candidate)) return candidate;
    }
  }
  return null;
}

test('resolveSafeRepoPath rejects an escape reached through a Windows 8.3 short-name alias', { skip: process.platform !== 'win32' }, () => {
  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-83-'));
  const longDirName = 'ALongDirectoryNameForShortNameTesting';
  const outerLongDir = path.join(tmpParent, longDirName);
  fs.mkdirSync(outerLongDir);
  fs.writeFileSync(path.join(outerLongDir, 'secret.md'), '# secret');

  const shortName = findShortName(tmpParent, longDirName);
  if (!shortName) {
    // 8.3 name generation is disabled on this volume — nothing to test here,
    // and the OS-level escape vector this test targets doesn't exist either.
    return;
  }

  const dir = fs.mkdtempSync(path.join(tmpParent, 'repo-'));
  const escapeViaShortName = path.posix.join('..', shortName, 'secret.md');
  assert.equal(resolveSafeRepoPath(dir, escapeViaShortName), null);
});

// The more general case the short-name test above is one instance of: a
// symlink (POSIX) or junction (Windows, doesn't need admin rights) sitting
// *inside* the repo but pointing outside it. The ref itself has no ".." at
// all and looks perfectly contained lexically — only the realpath-based
// second check (not the cheap string-prefix check) can catch this.
test('resolveSafeRepoPath rejects a ref reached through a symlink/junction that points outside the repo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-outside-'));
  fs.writeFileSync(path.join(outside, 'secret.md'), '# secret');

  const linkPath = path.join(dir, 'escape-link');
  try {
    if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'mklink', '/J', linkPath, outside], { encoding: 'utf8' });
    } else {
      fs.symlinkSync(outside, linkPath, 'dir');
    }
  } catch {
    // Some sandboxed environments block junction/symlink creation entirely
    // even without admin rights — nothing to test in that case.
    return;
  }

  // Lexically this looks totally normal — "escape-link/secret.md" never
  // leaves `dir` as a string. Only resolving the symlink/junction reveals
  // it actually points outside.
  assert.equal(resolveSafeRepoPath(dir, 'escape-link/secret.md'), null);
});
