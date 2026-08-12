const REQUIRED_TOP_LEVEL = ['project', 'schema_version', 'milestones', 'features'];
const REQUIRED_FEATURE_FIELDS = ['id', 'milestone', 'behavior', 'status', 'dependencies', 'verification'];
const VALID_STATUSES = ['not_started', 'in_progress', 'blocked', 'passing'];

export function validateStructural(data) {
  const errors = [];
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in data)) errors.push(`Missing top-level field: ${key}`);
  }
  if (!Array.isArray(data.features) || data.features.length === 0) {
    errors.push('features must be a non-empty array');
    return { ok: errors.length === 0, errors };
  }

  const milestoneIds = new Set((data.milestones || []).map((m) => m.id));
  const seenIds = new Set();

  for (const feature of data.features) {
    for (const field of REQUIRED_FEATURE_FIELDS) {
      if (!(field in feature)) errors.push(`Feature ${feature.id || '?'} missing field: ${field}`);
    }
    if (feature.id) {
      if (seenIds.has(feature.id)) errors.push(`Duplicate feature id: ${feature.id}`);
      seenIds.add(feature.id);
    }
    if (feature.status && !VALID_STATUSES.includes(feature.status)) {
      errors.push(`Feature ${feature.id} has invalid status: ${feature.status}`);
    }
    if (feature.milestone && !milestoneIds.has(feature.milestone)) {
      errors.push(`Feature ${feature.id} references unknown milestone: ${feature.milestone}`);
    }
    if (!Array.isArray(feature.verification) || feature.verification.length === 0) {
      errors.push(`Feature ${feature.id} must declare at least one verification entry`);
    }
  }

  return { ok: errors.length === 0, errors };
}
