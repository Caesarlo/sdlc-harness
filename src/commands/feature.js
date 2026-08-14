import path from 'node:path';
import { casTransaction } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';
import { FeatureNotFoundError } from '../lib/errors.js';
import { claimFeature } from '../lib/claims.js';
import { currentCommitSha } from '../lib/current-commit.js';

const PLACEHOLDER_PATTERN = /-(SCOPE|RELEASE)-\d+$/;

function activeClaim(feature, now = Date.now()) {
  return Boolean(feature.claim?.lease_until && new Date(feature.claim.lease_until).getTime() > now);
}

function evidenceMatchesCommit(evidence, commitSha) {
  return !commitSha || evidence.commit_sha === commitSha;
}

function matchingVerificationEvidence(feature, verification, verificationIndex, commitSha) {
  return (feature.evidence || []).filter((evidence) => {
    if (evidence.result !== 'passed' || !evidenceMatchesCommit(evidence, commitSha)) return false;
    if (verification.type === 'manual') {
      return evidence.kind === 'manual' && evidence.verification_index === verificationIndex;
    }
    if (evidence.kind !== 'test') return false;
    return evidence.command === verification.command || Boolean(evidence.ci);
  });
}

export function startFeature(repoRoot, featureId, { owner, actorId, ttlMinutes } = {}) {
  return claimFeature(repoRoot, featureId, { owner, actorId, ttlMinutes, requireReady: true });
}

export function completeFeature(repoRoot, featureId, { owner } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const commitSha = currentCommitSha(repoRoot);
  let completion;

  casTransaction(featureListPath, (data) => {
    const feature = data.features.find((f) => f.id === featureId);
    if (!feature) throw new FeatureNotFoundError(featureId);
    if (PLACEHOLDER_PATTERN.test(feature.id)) throw new Error(`Placeholder feature ${featureId} must be decomposed, not completed`);
    if (feature.status === 'passing') throw new Error(`Feature ${featureId} is already passing`);
    if (feature.status !== 'in_progress') {
      throw new Error(`Feature ${featureId} must be in_progress; run "sdlc-harness feature start ${featureId}" first`);
    }
    if (!activeClaim(feature)) throw new Error(`Feature ${featureId} must have an active claim before completion`);
    if (owner && feature.claim.owner !== owner) {
      throw new Error(`Feature ${featureId} is claimed by "${feature.claim.owner}", not "${owner}"`);
    }

    const unmet = (feature.dependencies || []).filter((dependencyId) => {
      const dependency = data.features.find((candidate) => candidate.id === dependencyId);
      return !dependency || dependency.status !== 'passing';
    });
    if (unmet.length > 0) throw new Error(`Feature ${featureId} has unmet dependencies: ${unmet.join(', ')}`);

    const verifications = feature.verification || [];
    if (verifications.length === 0) throw new Error(`Feature ${featureId} has no declared verification`);
    const matchedEvidence = verifications.map((verification, index) => (
      matchingVerificationEvidence(feature, verification, index + 1, commitSha)
    ));
    const missing = matchedEvidence
      .map((matches, index) => (matches.length === 0 ? index + 1 : null))
      .filter(Boolean);
    if (missing.length > 0) {
      const commitLabel = commitSha ? ` for current commit ${commitSha}` : '';
      throw new Error(`Feature ${featureId} is missing passing evidence${commitLabel} for verification(s): ${missing.join(', ')}`);
    }

    const latestVerificationAt = matchedEvidence
      .flat()
      .map((evidence) => Date.parse(evidence.recorded_at) || 0)
      .reduce((latest, value) => Math.max(latest, value), 0);
    const reviews = (feature.evidence || []).filter((evidence) => (
      evidence.kind === 'review'
      && evidence.result === 'passed'
      && evidenceMatchesCommit(evidence, commitSha)
      && (Date.parse(evidence.recorded_at) || 0) >= latestVerificationAt
    ));
    if (reviews.length === 0) {
      const commitLabel = commitSha ? ` for current commit ${commitSha}` : '';
      throw new Error(`Feature ${featureId} needs a passing review recorded after verification${commitLabel}`);
    }
    const independentReviews = reviews.filter((review) => review.reviewer !== feature.claim.owner);
    if (independentReviews.length === 0) {
      throw new Error(
        `Feature ${featureId} only has review evidence from its own claim owner ("${feature.claim.owner}"); `
        + 'record a review from a different reviewer before completing',
      );
    }

    completion = {
      owner: feature.claim.owner,
      claimId: feature.claim.id,
      review: independentReviews.at(-1),
    };
    feature.status = 'passing';
    feature.blocker = null;
    feature.claim = null;
    data.last_updated = new Date().toISOString();
  });

  appendEvent(repoRoot, {
    type: 'feature.completed',
    feature_id: featureId,
    owner: completion.owner,
    claim_id: completion.claimId,
    reviewer: completion.review.reviewer,
    commit_sha: commitSha,
  });
  return { featureId, commitSha };
}

export function blockFeature(repoRoot, featureId, { owner, reason } = {}) {
  if (!reason || !reason.trim()) throw new Error('A non-empty blocker reason is required');
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  let previousStatus;
  let claimId = null;

  casTransaction(featureListPath, (data) => {
    const feature = data.features.find((f) => f.id === featureId);
    if (!feature) throw new FeatureNotFoundError(featureId);
    if (feature.status === 'passing') throw new Error(`Passing feature ${featureId} cannot be blocked because passing is monotonic`);
    if (activeClaim(feature) && owner && feature.claim.owner !== owner) {
      throw new Error(`Feature ${featureId} is claimed by "${feature.claim.owner}", not "${owner}"`);
    }
    previousStatus = feature.status;
    claimId = feature.claim?.id || null;
    feature.status = 'blocked';
    feature.blocker = reason.trim();
    feature.claim = null;
    data.last_updated = new Date().toISOString();
  });

  appendEvent(repoRoot, {
    type: 'feature.blocked', feature_id: featureId, owner: owner || null,
    reason: reason.trim(), previous_status: previousStatus, claim_id: claimId,
  });
}

export function reopenFeature(repoRoot, featureId, { actor } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  let previousBlocker;
  casTransaction(featureListPath, (data) => {
    const feature = data.features.find((f) => f.id === featureId);
    if (!feature) throw new FeatureNotFoundError(featureId);
    if (feature.status !== 'blocked') throw new Error(`Feature ${featureId} must be blocked before it can be reopened`);
    previousBlocker = feature.blocker || null;
    feature.status = 'not_started';
    feature.blocker = null;
    feature.claim = null;
    data.last_updated = new Date().toISOString();
  });
  appendEvent(repoRoot, {
    type: 'feature.reopened', feature_id: featureId, actor: actor || null, previous_blocker: previousBlocker,
  });
}
