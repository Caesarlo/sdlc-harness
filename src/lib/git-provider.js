import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readJsonWithStamp } from './atomic-write.js';
import { claimFeature, listReadyFeatures, NoReadyFeatureError } from './claims.js';
import { appendEvent } from './events.js';

export { NoReadyFeatureError };

export class GitPushConflictUnresolvedError extends Error {
  constructor(featureId, reason) {
    super(`Could not resolve git push conflict while claiming ${featureId}: ${reason}`);
    this.name = 'GitPushConflictUnresolvedError';
    this.featureId = featureId;
  }
}

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function isClaimExpired(claim, now = Date.now()) {
  return !claim || !claim.lease_until || new Date(claim.lease_until).getTime() <= now;
}

function commitClaim(repoRoot, featureId, owner) {
  git(repoRoot, ['add', 'feature_list.json']);
  git(repoRoot, ['commit', '-m', `claim ${featureId} for ${owner}`]);
}

// The git coordination provider has no real-time cross-machine lock — two
// clones can each successfully claim locally, and the actual conflict only
// surfaces when the second one tries to push. This claims featureId, commits,
// and pushes; if the push is rejected (someone else pushed a claim first),
// it discards the unpushed local commit (git fetch + reset --hard to the
// remote, since a local claim attempt that never reached the remote is safe
// to throw away and redo), rechecks the target feature's fresh state, and
// either retries the same feature (if it's still actually free — the
// rejection can be unrelated history divergence) or falls back to the next
// ready feature from the queue. Every conflict and resolution is recorded
// as an audit event.
export function claimAndPush(repoRoot, featureId, {
  owner, actorId, ttlMinutes, remote = 'origin', branch = 'main', maxAttempts = 5,
} = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  let targetFeatureId = featureId;
  let usedFallback = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const claim = claimFeature(repoRoot, targetFeatureId, { owner, actorId, ttlMinutes });
    commitClaim(repoRoot, targetFeatureId, owner);

    const pushResult = git(repoRoot, ['push', remote, branch]);
    if (pushResult.status === 0) {
      return {
        status: usedFallback ? 'claimed-fallback' : 'claimed',
        featureId: targetFeatureId,
        originalFeatureId: featureId,
        claim,
        attempts: attempt,
      };
    }

    git(repoRoot, ['fetch', remote, branch]);
    const resetResult = git(repoRoot, ['reset', '--hard', `${remote}/${branch}`]);
    if (resetResult.status !== 0) {
      throw new GitPushConflictUnresolvedError(targetFeatureId, `could not resync with remote: ${(resetResult.stderr || '').trim()}`);
    }
    appendEvent(repoRoot, { type: 'git.push_conflict', feature_id: targetFeatureId, owner, attempt });

    const { data } = readJsonWithStamp(featureListPath);
    const fresh = data.features.find((f) => f.id === targetFeatureId);
    if (!fresh || isClaimExpired(fresh.claim)) {
      // Rejection was unrelated to our target feature (or it's still free
      // for some other reason) — just retry claiming the same one.
      continue;
    }

    appendEvent(repoRoot, {
      type: 'git.claim_conflict_resolved',
      feature_id: targetFeatureId,
      owner,
      resolution: 'lost_race',
      winner: fresh.claim.owner,
    });

    const ready = listReadyFeatures(data);
    if (ready.length === 0) throw new NoReadyFeatureError();
    targetFeatureId = ready[0].id;
    usedFallback = true;
  }

  throw new GitPushConflictUnresolvedError(targetFeatureId, `exceeded ${maxAttempts} attempts`);
}
