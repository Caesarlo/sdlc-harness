import { spawnSync } from 'node:child_process';

// Reads feature_list.json as it existed at a given git ref, without
// touching the working tree. Returns null (never throws) if the repo isn't
// a git repo, the ref doesn't exist, or the file didn't exist at that ref —
// callers treat "no baseline available" as "nothing to compare against".
export function readFeatureListAtRef(repoRoot, ref) {
  const result = spawnSync('git', ['show', `${ref}:feature_list.json`], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

// Picks the ref to diff against for the passing_is_monotonic check. Explicit
// env vars take priority (HARNESS_BASE_REF for manual use, GITHUB_BASE_REF
// for a GitHub Actions pull_request run); otherwise falls back to whichever
// of the common default-branch names actually resolves in this repo.
export function resolveBaseRef(repoRoot) {
  if (process.env.HARNESS_BASE_REF) return process.env.HARNESS_BASE_REF;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;

  for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    const check = spawnSync('git', ['rev-parse', '--verify', '--quiet', candidate], { cwd: repoRoot, encoding: 'utf8' });
    if (check.status === 0) return candidate;
  }
  return null;
}
