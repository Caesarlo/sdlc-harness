import { loadFeatureList } from '../lib/load-feature-list.js';

export function runStatus(repoRoot) {
  const data = loadFeatureList(repoRoot);

  const counts = { not_started: 0, in_progress: 0, blocked: 0, passing: 0 };
  for (const feature of data.features) {
    counts[feature.status] = (counts[feature.status] || 0) + 1;
  }

  const activeFeatures = data.features
    .filter((f) => f.status === 'in_progress')
    .map((f) => ({ id: f.id, title: f.title, behavior: f.behavior, owner: f.owner || null }));

  return {
    project: data.project,
    counts,
    activeFeatures,
    milestoneCount: (data.milestones || []).length,
  };
}
