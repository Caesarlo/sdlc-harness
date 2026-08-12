export function validateMilestoneOrder(data) {
  const errors = [];
  const milestoneIndex = new Map((data.milestones || []).map((m, i) => [m.id, i]));
  const byId = new Map(data.features.map((f) => [f.id, f]));

  for (const feature of data.features) {
    const featureIndex = milestoneIndex.get(feature.milestone);
    if (featureIndex === undefined) continue;
    for (const depId of feature.dependencies || []) {
      const dep = byId.get(depId);
      if (!dep) continue;
      const depIndex = milestoneIndex.get(dep.milestone);
      if (depIndex === undefined) continue;
      if (depIndex > featureIndex) {
        errors.push(`Feature ${feature.id} (milestone ${feature.milestone}) depends on ${depId} (milestone ${dep.milestone}), which comes later`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
