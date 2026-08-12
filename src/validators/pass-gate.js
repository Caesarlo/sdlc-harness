const PLACEHOLDER_PATTERN = /-(SCOPE|RELEASE)-\d+$/;

export function validatePassGate(data, previousSnapshot) {
  const errors = [];

  const inProgress = data.features.filter((f) => f.status === 'in_progress');
  if (inProgress.length > 1) {
    errors.push(`Only one feature may be in_progress at a time, found ${inProgress.length}: ${inProgress.map((f) => f.id).join(', ')}`);
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
