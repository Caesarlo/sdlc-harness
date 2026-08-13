const PLACEHOLDER_PATTERN = /-(SCOPE|RELEASE)-\d+$/;
const DEFAULT_OWNER_BUCKET = '_default';

function resolveWipLimit(rules) {
  if (!rules) return 1;
  if (typeof rules.wip_limit_per_owner === 'number') return rules.wip_limit_per_owner;
  if (rules.single_active_feature === false) return Infinity;
  return 1;
}

export function validatePassGate(data, previousSnapshot) {
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
    if (!evidence.some((e) => e.kind === 'review')) {
      errors.push(`Feature ${feature.id} is passing but has no evidence entry with kind "review"`);
    }
  }

  if (previousSnapshot) {
    const previouslyPassing = (previousSnapshot.features || [])
      .filter((f) => f.status === 'passing')
      .map((f) => f.id);
    for (const id of previouslyPassing) {
      const current = data.features.find((f) => f.id === id);
      if (!current || current.status !== 'passing') {
        errors.push(`Feature ${id} was passing in the previous snapshot and is no longer passing (passing_is_monotonic)`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
