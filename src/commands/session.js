import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { runValidate } from './validate.js';
import { runStatus } from './status.js';
import { runEnvCheck } from '../lib/env-check.js';
import { appendEvent } from '../lib/events.js';

function gitStatusSummary(repoRoot, exec) {
  const result = exec('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  const lines = (result.stdout ?? '').split('\n').filter((line) => line.trim().length > 0);
  const commitResult = exec('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return {
    clean: lines.length === 0,
    changedFiles: lines.map((line) => line.trim()),
    commitSha: commitResult.status === 0 ? commitResult.stdout.trim() : null,
  };
}

// A read-only close-of-session report, not a state mutation: there's no
// "session" entity in feature_list.json to transition, so this exists to
// answer "can the next Agent (or human) pick this repo up without having to
// re-derive what I already know" — validate passing, the project's own
// environment commands (if configured) passing, and what's left to do next.
// Uncommitted changes are reported, not treated as failure — normal WIP.
export function runSessionClose(repoRoot, { exec = spawnSync } = {}) {
  const validate = runValidate(repoRoot);
  const env = runEnvCheck(repoRoot, { exec });
  const git = gitStatusSummary(repoRoot, exec);
  const status = runStatus(repoRoot);

  const ok = validate.ok && (!env.configured || env.ok);

  appendEvent(repoRoot, {
    type: 'session.closed',
    ok,
    validate_ok: validate.ok,
    env_configured: env.configured,
    env_ok: env.ok,
    commit_sha: git.commitSha,
    git_clean: git.clean,
  });

  return {
    ok, validate, env, git, status,
  };
}
