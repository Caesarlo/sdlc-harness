import { resolveWipLimit, DEFAULT_OWNER_BUCKET } from '../lib/wip-limit.js';

const PLACEHOLDER_PATTERN = /-(SCOPE|RELEASE)-\d+$/;

export function validatePassGate(data, previousSnapshot, archivedIds = new Set()) {
  const errors = [];

  const wipLimit = resolveWipLimit(data.rules);
  const inProgressByOwner = new Map();
  for (const feature of data.features.filter((f) => f.status === 'in_progress')) {
    const owner = feature.owner || DEFAULT_OWNER_BUCKET;
    if (!inProgressByOwner.has(owner)) inProgressByOwner.set(owner, []);
    inProgressByOwner.get(owner).push(feature);
  }
  for (const [owner, features] of inProgressByOwner) {
    if (features.length > wipLimit) {
      const ownerLabel = owner === DEFAULT_OWNER_BUCKET ? 'the default owner bucket' : `owner "${owner}"`;
      errors.push(`At most ${wipLimit} feature(s) may be in_progress for ${ownerLabel}, found ${features.length}: ${features.map((f) => f.id).join(', ')}`);
    }
  }

  for (const feature of data.features) {
    if (feature.status !== 'passing') continue;
    if (PLACEHOLDER_PATTERN.test(feature.id)) {
      errors.push(`Placeholder feature ${feature.id} must never be marked passing`);
      continue;
    }
    const evidence = feature.evidence || [];
    if (evidence.length === 0) {
      errors.push(`Feature ${feature.id} is passing but has no evidence`);
      continue;
    }
    if (!evidence.some((e) => e.kind === 'review' && e.result === 'passed')) {
      errors.push(`Feature ${feature.id} is passing but has no passing review evidence`);
    }
    const hasSuccessfulCiRun = evidence.some((e) => e.kind === 'test' && e.result === 'passed' && e.ci);
    for (const [index, verification] of (feature.verification || []).entries()) {
      const hasEvidence = verification.type === 'manual'
        ? evidence.some((e) => e.kind === 'manual' && e.verification_index === index + 1 && e.result === 'passed')
        : hasSuccessfulCiRun || evidence.some((e) => (
          e.kind === 'test' && e.command === verification.command && e.result === 'passed'
        ));
      if (!hasEvidence) {
        errors.push(`Feature ${feature.id} is passing but verification ${index + 1} has no passing evidence`);
      }
    }
  }

  if (previousSnapshot) {
    const previouslyPassing = (previousSnapshot.features || [])
      .filter((f) => f.status === 'passing')
      .map((f) => f.id);
    for (const id of previouslyPassing) {
      if (archivedIds.has(id)) continue; // moved to .harness/archive/, not regressed
      const current = data.features.find((f) => f.id === id);
      if (!current || current.status !== 'passing') {
        errors.push(`Feature ${id} was passing in the previous snapshot and is no longer passing (passing_is_monotonic)`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
