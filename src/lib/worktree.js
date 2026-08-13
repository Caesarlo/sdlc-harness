import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readJsonWithStamp, casTransaction } from './atomic-write.js';
import { appendEvent } from './events.js';
import { FeatureNotFoundError } from './errors.js';

export class NoActiveClaimError extends Error {
  constructor(featureId) {
    super(`Feature ${featureId} must be claimed before creating a workspace for it`);
    this.name = 'NoActiveClaimError';
    this.featureId = featureId;
  }
}

export class WorkspaceExistsError extends Error {
  constructor(featureId, existingPath) {
    super(`Feature ${featureId} already has a workspace at ${existingPath}`);
    this.name = 'WorkspaceExistsError';
    this.featureId = featureId;
  }
}

export class NoWorkspaceError extends Error {
  constructor(featureId) {
    super(`Feature ${featureId} has no workspace to remove`);
    this.name = 'NoWorkspaceError';
    this.featureId = featureId;
  }
}

export class DirtyWorkspaceError extends Error {
  constructor(featureId, reason) {
    super(`Refusing to remove workspace for ${featureId}: ${reason} (pass force to override)`);
    this.name = 'DirtyWorkspaceError';
    this.featureId = featureId;
    this.reason = reason;
  }
}

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function branchNameFor(featureId) {
  return `feature/${featureId}`;
}

function worktreePathFor(repoRoot, featureId) {
  return path.join(repoRoot, '.worktrees', featureId);
}

function branchExists(repoRoot, branch) {
  return git(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0;
}

function isClaimActive(feature, now = Date.now()) {
  const claim = feature.claim;
  return Boolean(claim && claim.lease_until && new Date(claim.lease_until).getTime() > now);
}

// A worktree with uncommitted changes, or commits that aren't pushed
// anywhere, must never be silently deleted — lease expiry only releases the
// claim, cleanup of the actual working directory is a separate, more
// cautious decision. Returns a human-readable reason if the workspace is
// "dirty" by either definition, or null if it's safe to remove.
function checkDirty(worktreePath, baseBranch) {
  if (!fs.existsSync(worktreePath)) return null;

  const status = git(worktreePath, ['status', '--porcelain']);
  if (status.stdout && status.stdout.trim().length > 0) {
    return 'uncommitted changes are present';
  }

  const upstream = git(worktreePath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream.status === 0) {
    const ahead = git(worktreePath, ['rev-list', '--count', '@{u}..HEAD']);
    if (ahead.stdout && ahead.stdout.trim() !== '0') return 'commits have not been pushed to their upstream';
    return null;
  }

  // No upstream configured at all — the base branch is the best available
  // signal for "this branch has local-only work nobody else can see".
  const ahead = git(worktreePath, ['rev-list', '--count', `${baseBranch}..HEAD`]);
  if (ahead.stdout && ahead.stdout.trim() !== '0') return 'commits have not been pushed anywhere (no upstream configured)';
  return null;
}

export function createWorkspace(repoRoot, featureId, { baseBranch = 'main' } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');

  const { data: preData } = readJsonWithStamp(featureListPath);
  const preFeature = preData.features.find((f) => f.id === featureId);
  if (!preFeature) throw new FeatureNotFoundError(featureId);
  if (!isClaimActive(preFeature)) throw new NoActiveClaimError(featureId);
  if (preFeature.workspace) throw new WorkspaceExistsError(featureId, preFeature.workspace.path);

  const branch = branchNameFor(featureId);
  const worktreePath = worktreePathFor(repoRoot, featureId);

  if (fs.existsSync(worktreePath)) throw new WorkspaceExistsError(featureId, worktreePath);
  if (branchExists(repoRoot, branch)) {
    throw new Error(`Branch ${branch} already exists — refusing to reuse it for a new workspace (it may already be checked out elsewhere).`);
  }

  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  const addResult = git(repoRoot, ['worktree', 'add', '-b', branch, worktreePath, baseBranch]);
  if (addResult.status !== 0) {
    throw new Error(`git worktree add failed: ${(addResult.stderr || addResult.stdout || '').trim()}`);
  }

  const baseCommit = git(repoRoot, ['rev-parse', baseBranch]).stdout.trim();
  const workspace = {
    branch,
    path: worktreePath,
    base_branch: baseBranch,
    base_commit: baseCommit,
    created_at: new Date().toISOString(),
  };

  try {
    casTransaction(featureListPath, (data) => {
      const feature = data.features.find((f) => f.id === featureId);
      if (!feature) throw new FeatureNotFoundError(featureId);
      if (feature.workspace) throw new WorkspaceExistsError(featureId, feature.workspace.path);
      feature.workspace = workspace;
    });
  } catch (err) {
    // The git side effect already happened; if we can't record it (e.g. a
    // genuine race where someone else created one first) roll it back
    // rather than leaving an orphaned, untracked worktree on disk.
    git(repoRoot, ['worktree', 'remove', '--force', worktreePath]);
    git(repoRoot, ['branch', '-D', branch]);
    throw err;
  }

  appendEvent(repoRoot, { type: 'workspace.created', feature_id: featureId, branch, path: worktreePath, base_branch: baseBranch });
  return workspace;
}

export function removeWorkspace(repoRoot, featureId, { force = false } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const { data } = readJsonWithStamp(featureListPath);
  const feature = data.features.find((f) => f.id === featureId);
  if (!feature) throw new FeatureNotFoundError(featureId);
  if (!feature.workspace) throw new NoWorkspaceError(featureId);

  const { path: worktreePath, branch, base_branch: baseBranch } = feature.workspace;

  if (!force) {
    const dirty = checkDirty(worktreePath, baseBranch);
    if (dirty) throw new DirtyWorkspaceError(featureId, dirty);
  }

  if (fs.existsSync(worktreePath)) {
    const removeResult = git(repoRoot, ['worktree', 'remove', worktreePath, ...(force ? ['--force'] : [])]);
    if (removeResult.status !== 0) {
      throw new Error(`git worktree remove failed: ${(removeResult.stderr || removeResult.stdout || '').trim()}`);
    }
  }
  git(repoRoot, ['branch', '-D', branch]);

  casTransaction(featureListPath, (d) => {
    const f = d.features.find((x) => x.id === featureId);
    if (f) f.workspace = null;
  });

  appendEvent(repoRoot, { type: 'workspace.removed', feature_id: featureId, branch, forced: force });
}

// Removes workspaces for features whose claim is no longer active (released
// or expired) — never touches a workspace whose feature still has a live
// claim, since that means someone may still be actively using it. Dirty
// workspaces are skipped (reported, not force-removed) unless force is set.
export function pruneWorkspaces(repoRoot, { force = false } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const { data } = readJsonWithStamp(featureListPath);

  const results = [];
  for (const feature of data.features) {
    if (!feature.workspace) continue;
    if (isClaimActive(feature)) continue;

    try {
      removeWorkspace(repoRoot, feature.id, { force });
      results.push({ featureId: feature.id, action: 'removed' });
    } catch (err) {
      if (err instanceof DirtyWorkspaceError) {
        results.push({ featureId: feature.id, action: 'skipped-dirty', reason: err.reason });
      } else {
        throw err;
      }
    }
  }
  return results;
}

export function listWorkspaces(repoRoot) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const { data } = readJsonWithStamp(featureListPath);
  return data.features
    .filter((f) => f.workspace)
    .map((f) => ({
      featureId: f.id,
      ...f.workspace,
      claimActive: isClaimActive(f),
      existsOnDisk: fs.existsSync(f.workspace.path),
    }));
}
