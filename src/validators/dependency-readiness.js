export function validateDependencyReadiness(data) {
  const errors = [];
  const byId = new Map(data.features.map((f) => [f.id, f]));

  for (const feature of data.features) {
    if (feature.status !== 'in_progress') continue;
    for (const depId of feature.dependencies || []) {
      const dep = byId.get(depId);
      if (!dep) continue;
      if (dep.status !== 'passing') {
        errors.push(`Feature ${feature.id} is in_progress but depends on ${depId}, which is not passing (status: ${dep.status})`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
