export function validateDependencyCycles(data, archivedIds = new Set()) {
  const errors = [];
  const byId = new Map(data.features.map((f) => [f.id, f]));

  for (const feature of data.features) {
    for (const depId of feature.dependencies || []) {
      if (!byId.has(depId) && !archivedIds.has(depId)) errors.push(`Feature ${feature.id} depends on unknown feature: ${depId}`);
    }
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(data.features.map((f) => [f.id, WHITE]));
  const stack = [];

  function visit(id) {
    color.set(id, GRAY);
    stack.push(id);
    const feature = byId.get(id);
    for (const depId of feature?.dependencies || []) {
      if (!byId.has(depId)) continue;
      if (color.get(depId) === GRAY) {
        const cycleStart = stack.indexOf(depId);
        errors.push(`Dependency cycle: ${stack.slice(cycleStart).concat(depId).join(' -> ')}`);
      } else if (color.get(depId) === WHITE) {
        visit(depId);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  }

  for (const feature of data.features) {
    if (color.get(feature.id) === WHITE) visit(feature.id);
  }

  return { ok: errors.length === 0, errors };
}
