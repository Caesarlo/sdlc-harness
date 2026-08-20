import crypto from 'node:crypto';
import path from 'node:path';
import { casTransaction } from './atomic-write.js';
import { appendEvent } from './events.js';
import { FeatureNotFoundError } from './errors.js';
import { resolveWipLimit } from './wip-limit.js';
import { loadArchivedFeatureIds } from './archive.js';

export const DEFAULT_TTL_MINUTES = 120;

export class ClaimConflictError extends Error {
  constructor(featureId, currentOwner) {
    super(`Feature ${featureId} is already claimed by ${currentOwner}`);
    this.name = 'ClaimConflictError';
    this.featureId = featureId;
    this.currentOwner = currentOwner;
  }
}

export class WipLimitExceededError extends Error {
  constructor(owner, limit) {
    super(`Owner "${owner}" already has ${limit} active claim(s) (wip_limit_per_owner)`);
    this.name = 'WipLimitExceededError';
    this.owner = owner;
    this.limit = limit;
  }
}

export class NotClaimOwnerError extends Error {
  constructor(featureId, currentOwner, attemptedOwner) {
    super(`Feature ${featureId} is claimed by "${currentOwner}", not "${attemptedOwner}"`);
    this.name = 'NotClaimOwnerError';
    this.featureId = featureId;
    this.currentOwner = currentOwner;
  }
}

export class ClaimNotExpiredError extends Error {
  constructor(featureId, leaseUntil) {
    super(`Feature ${featureId}'s claim lease has not expired yet (until ${leaseUntil})`);
    this.name = 'ClaimNotExpiredError';
    this.featureId = featureId;
    this.leaseUntil = leaseUntil;
  }
}

export class NoClaimError extends Error {
  constructor(featureId) {
    super(`Feature ${featureId} has no active claim`);
    this.name = 'NoClaimError';
    this.featureId = featureId;
  }
}

export class NoReadyFeatureError extends Error {
  constructor() {
    super('No ready feature available to claim (all are either claimed, in progress, or have unmet dependencies)');
    this.name = 'NoReadyFeatureError';
  }
}

function isLeaseExpired(claim, now = new Date()) {
  if (!claim || !claim.lease_until) return true;
  return new Date(claim.lease_until).getTime() <= now.getTime();
}

function findFeature(data, featureId) {
  const feature = (data.features || []).find((f) => f.id === featureId);
  if (!feature) throw new FeatureNotFoundError(featureId);
  return feature;
}

// A claim counts against its owner's WIP limit only while its lease is
// still valid — an expired claim is available for takeover and shouldn't
// block that same owner (or anyone else) from claiming something else.
function activeClaimCountForOwner(data, owner, excludeFeatureId = null) {
  return (data.features || []).filter(
    (f) => f.id !== excludeFeatureId && f.claim && f.claim.owner === owner && !isLeaseExpired(f.claim),
  ).length;
}

function newClaimRecord({ owner, actorId, ttlMinutes, extra = {} }) {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    owner,
    // actor_id defaults to owner so single-agent-per-person usage never has
    // to think about this field, but a person running multiple concurrent
    // Agent sessions can pass a distinct actor_id per session — claim
    // uniqueness is still keyed on feature id, not on (owner, actor_id), so
    // two actors under the same owner can never claim the same feature.
    actor_id: actorId || owner,
    claimed_at: now.toISOString(),
    lease_until: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
    ...extra,
  };
}

// Lower `priority` runs first. Features with no `priority` sort after every
// prioritized feature, in their original list order — so repos that never
// set priority keep the old "array order is priority" behavior unchanged.
function priorityRank(feature) {
  return typeof feature.priority === 'number' ? feature.priority : Number.POSITIVE_INFINITY;
}

// Features eligible for `claim --next`: not started, not currently under an
// unexpired claim, and every dependency is passing. Sorted by priority
// (Array.prototype.sort is stable, so ties keep list order). `archivedIds`
// are feature ids moved to .harness/archive/ — they were passing when
// archived and count as satisfied dependencies same as a live passing
// feature (see src/lib/archive.js).
export function listReadyFeatures(data, archivedIds = new Set()) {
  const passingIds = new Set((data.features || []).filter((f) => f.status === 'passing').map((f) => f.id));
  return (data.features || [])
    .filter((f) => {
      if (f.status !== 'not_started') return false;
      if (f.claim && !isLeaseExpired(f.claim)) return false;
      return (f.dependencies || []).every((d) => passingIds.has(d) || archivedIds.has(d));
    })
    .sort((a, b) => priorityRank(a) - priorityRank(b));
}

export function claimFeature(repoRoot, featureId, {
  owner, actorId, ttlMinutes = DEFAULT_TTL_MINUTES, requireReady = false,
} = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const archivedIds = loadArchivedFeatureIds(repoRoot);
  const claim = casTransaction(featureListPath, (data) => {
    const feature = findFeature(data, featureId);
    if (requireReady) {
      if (feature.status !== 'not_started') {
        throw new Error(`Feature ${featureId} is ${feature.status}, not ready to start`);
      }
      const passingIds = new Set((data.features || []).filter((f) => f.status === 'passing').map((f) => f.id));
      const unmet = (feature.dependencies || []).filter((id) => !passingIds.has(id) && !archivedIds.has(id));
      if (unmet.length > 0) throw new Error(`Feature ${featureId} has unmet dependencies: ${unmet.join(', ')}`);
    }
    if (feature.claim && !isLeaseExpired(feature.claim)) {
      throw new ClaimConflictError(featureId, feature.claim.owner);
    }
    const wipLimit = resolveWipLimit(data.rules);
    if (activeClaimCountForOwner(data, owner, featureId) >= wipLimit) {
      throw new WipLimitExceededError(owner, wipLimit);
    }
    const record = newClaimRecord({ owner, actorId, ttlMinutes });
    feature.claim = record;
    if (!feature.owner) feature.owner = owner;
    if (feature.status === 'not_started') feature.status = 'in_progress';
    return record;
  });

  appendEvent(repoRoot, { type: 'feature.claimed', feature_id: featureId, owner, actor_id: claim.actor_id, claim_id: claim.id });
  return claim;
}

export function claimNextFeature(repoRoot, { owner, actorId, ttlMinutes = DEFAULT_TTL_MINUTES } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const archivedIds = loadArchivedFeatureIds(repoRoot);
  const claim = casTransaction(featureListPath, (data) => {
    const wipLimit = resolveWipLimit(data.rules);
    if (activeClaimCountForOwner(data, owner) >= wipLimit) {
      throw new WipLimitExceededError(owner, wipLimit);
    }
    const ready = listReadyFeatures(data, archivedIds);
    if (ready.length === 0) throw new NoReadyFeatureError();
    const feature = ready[0];
    const record = newClaimRecord({ owner, actorId, ttlMinutes, extra: { feature_id: feature.id } });
    feature.claim = record;
    if (!feature.owner) feature.owner = owner;
    feature.status = 'in_progress';
    return record;
  });

  appendEvent(repoRoot, { type: 'feature.claimed', feature_id: claim.feature_id, owner, actor_id: claim.actor_id, claim_id: claim.id, via: 'claim-next' });
  return claim;
}

export function releaseFeature(repoRoot, featureId, { owner } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  casTransaction(featureListPath, (data) => {
    const feature = findFeature(data, featureId);
    if (!feature.claim) return; // already released — idempotent no-op
    if (owner && feature.claim.owner !== owner) {
      throw new NotClaimOwnerError(featureId, feature.claim.owner, owner);
    }
    feature.claim = null;
    // claimFeature/claimNextFeature are the only things that move a feature
    // to in_progress in this codebase (there's no `transition` command yet),
    // so releasing must undo that — otherwise pass-gate's status-based WIP
    // count and claims.js's claim-based WIP count drift apart, and the
    // feature never becomes eligible for `claim --next` again.
    if (feature.status === 'in_progress') feature.status = 'not_started';
  });

  appendEvent(repoRoot, { type: 'feature.released', feature_id: featureId, owner: owner || null });
}

export function renewClaim(repoRoot, featureId, { owner, ttlMinutes = DEFAULT_TTL_MINUTES } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  casTransaction(featureListPath, (data) => {
    const feature = findFeature(data, featureId);
    if (!feature.claim) throw new NoClaimError(featureId);
    if (owner && feature.claim.owner !== owner) {
      throw new NotClaimOwnerError(featureId, feature.claim.owner, owner);
    }
    const now = new Date();
    feature.claim.lease_until = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();
    feature.claim.heartbeat_at = now.toISOString();
  });

  appendEvent(repoRoot, { type: 'claim.renewed', feature_id: featureId, owner: owner || null });
}

export function takeoverExpiredClaim(repoRoot, featureId, { owner, actorId, ttlMinutes = DEFAULT_TTL_MINUTES } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const claim = casTransaction(featureListPath, (data) => {
    const feature = findFeature(data, featureId);
    if (!feature.claim) throw new NoClaimError(featureId);
    if (!isLeaseExpired(feature.claim)) {
      throw new ClaimNotExpiredError(featureId, feature.claim.lease_until);
    }
    const previousOwner = feature.claim.owner;
    const record = newClaimRecord({ owner, actorId, ttlMinutes, extra: { taken_over_from: previousOwner } });
    feature.claim = record;
    feature.owner = owner;
    return record;
  });

  appendEvent(repoRoot, { type: 'claim.taken_over', feature_id: featureId, owner, previous_owner: claim.taken_over_from, claim_id: claim.id });
  return claim;
}
