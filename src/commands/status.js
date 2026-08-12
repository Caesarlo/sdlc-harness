import { loadFeatureList } from '../lib/load-feature-list.js';

export function runStatus(repoRoot) {
  const data = loadFeatureList(repoRoot);

  const counts = { not_started: 0, in_progress: 0, blocked: 0, passing: 0 };
  for (const feature of data.features) {
    counts[feature.status] = (counts[feature.status] || 0) + 1;
  }

  const active = data.features.find((f) => f.status === 'in_progress');

  return {
    project: data.project,
    counts,
    activeFeature: active ? { id: active.id, title: active.title, behavior: active.behavior } : null,
    milestoneCount: (data.milestones || []).length,
  };
}
