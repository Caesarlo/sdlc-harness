import { loadFeatureList } from '../lib/load-feature-list.js';
import { listReadyFeatures } from '../lib/claims.js';
import { listArtifactApprovals } from './artifact-approval.js';
import { buildTraceability } from '../lib/traceability.js';

function featureSummary(feature) {
  return {
    id: feature.id,
    title: feature.title || null,
    behavior: feature.behavior || null,
    owner: feature.owner || null,
    dependencies: feature.dependencies || [],
    sourceRefs: feature.source_refs || [],
  };
}

export function runStatus(repoRoot) {
  const data = loadFeatureList(repoRoot);
  const traceability = buildTraceability(repoRoot, data);

  const counts = { not_started: 0, in_progress: 0, blocked: 0, passing: 0 };
  for (const feature of data.features) {
    counts[feature.status] = (counts[feature.status] || 0) + 1;
  }

  const activeFeatures = data.features
    .filter((f) => f.status === 'in_progress')
    .map((f) => ({ id: f.id, title: f.title, behavior: f.behavior, owner: f.owner || null }));

  const readyFeatures = listReadyFeatures(data).map(featureSummary);
  const blockedFeatures = data.features
    .filter((feature) => feature.status === 'blocked')
    .map((feature) => ({ ...featureSummary(feature), blocker: feature.blocker || null }));

  const nextActions = [];
  for (const feature of activeFeatures) {
    nextActions.push(`Continue ${feature.id}; run verify, record review, then feature complete.`);
  }
  if (activeFeatures.length === 0 && readyFeatures.length > 0) {
    nextActions.push(`Start ${readyFeatures[0].id} with "sdlc-harness feature start ${readyFeatures[0].id}".`);
  }
  if (activeFeatures.length === 0 && readyFeatures.length === 0 && blockedFeatures.length > 0) {
    nextActions.push(`Resolve blocker for ${blockedFeatures[0].id}, then run "sdlc-harness feature reopen ${blockedFeatures[0].id}".`);
  }
  if (data.features.length > 0 && counts.passing === data.features.length) {
    nextActions.push('All declared features are passing; proceed to milestone acceptance or release work.');
  }

  return {
    project: data.project,
    counts,
    activeFeatures,
    readyFeatures,
    blockedFeatures,
    artifactApprovals: listArtifactApprovals(repoRoot, data),
    traceability: {
      applicable: traceability.applicable,
      deferred: traceability.deferred,
      ok: traceability.ok,
      uncoveredRequirements: traceability.uncoveredRequirements,
      orphanStories: traceability.orphanStories,
      orphanFeatures: traceability.orphanFeatures,
      unverifiedAcceptanceCriteria: traceability.unverifiedAcceptanceCriteria,
      uncoveredAcceptanceCriteria: traceability.uncoveredAcceptanceCriteria,
      unknownReferences: traceability.unknownReferences,
    },
    nextActions,
    milestoneCount: (data.milestones || []).length,
  };
}
