import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { casTransaction } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';
import { currentCommitSha } from '../lib/current-commit.js';
import { resolveSafeRepoPath } from '../lib/safe-path.js';

export function artifactContentHash(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

export function recordArtifactApproval(repoRoot, artifact, { actor, summary } = {}) {
  if (!actor || !actor.trim()) throw new Error('An approval actor is required');
  if (!summary || !summary.trim()) throw new Error('A non-empty approval summary is required');

  const resolved = resolveSafeRepoPath(repoRoot, artifact);
  if (!resolved || !fs.statSync(resolved).isFile()) {
    throw new Error(`Approval artifact must be an existing file inside the repository: ${artifact}`);
  }

  const relativeArtifact = path.relative(path.resolve(repoRoot), resolved).split(path.sep).join('/');
  if (relativeArtifact === 'feature_list.json') {
    throw new Error('feature_list.json cannot approve itself because recording evidence changes its own content hash');
  }
  const evidence = {
    kind: 'approval',
    result: 'approved',
    artifact: relativeArtifact,
    actor: actor.trim(),
    summary: summary.trim(),
    content_hash: artifactContentHash(resolved),
    commit_sha: currentCommitSha(repoRoot),
    recorded_at: new Date().toISOString(),
  };

  casTransaction(path.join(repoRoot, 'feature_list.json'), (data) => {
    data.evidence = [...(data.evidence || []), evidence];
    data.last_updated = new Date().toISOString();
  });

  appendEvent(repoRoot, {
    type: 'artifact.approved',
    artifact: evidence.artifact,
    actor: evidence.actor,
    content_hash: evidence.content_hash,
    commit_sha: evidence.commit_sha,
  });
  return evidence;
}

export function listArtifactApprovals(repoRoot, data) {
  const latest = new Map();
  for (const evidence of data.evidence || []) {
    if (evidence.kind === 'approval' && evidence.artifact) latest.set(evidence.artifact, evidence);
  }

  return [...latest.values()].map((evidence) => {
    const resolved = resolveSafeRepoPath(repoRoot, evidence.artifact);
    const actualHash = resolved && fs.statSync(resolved).isFile() ? artifactContentHash(resolved) : null;
    return {
      artifact: evidence.artifact,
      actor: evidence.actor,
      summary: evidence.summary,
      recordedAt: evidence.recorded_at,
      commitSha: evidence.commit_sha ?? null,
      contentHash: evidence.content_hash,
      currentContentHash: actualHash,
      valid: actualHash !== null && actualHash === evidence.content_hash,
    };
  }).sort((a, b) => a.artifact.localeCompare(b.artifact));
}
