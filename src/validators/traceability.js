import { buildTraceability } from '../lib/traceability.js';

export function validateTraceability(data, repoRoot) {
  const matrix = buildTraceability(repoRoot, data);
  const errors = [...matrix.unknownReferences];

  if (matrix.applicable && !matrix.deferred) {
    for (const id of matrix.uncoveredRequirements) errors.push(`Requirement ${id} is not covered by any feature`);
    for (const id of matrix.orphanStories) errors.push(`User story ${id} does not reference an FR/NFR requirement`);
    for (const id of matrix.orphanFeatures) errors.push(`Feature ${id} does not reference an FR/NFR or US-N.AC-N`);
    for (const id of matrix.uncoveredAcceptanceCriteria) errors.push(`Acceptance criterion ${id} is not covered by any feature`);
    for (const id of matrix.unverifiedAcceptanceCriteria) errors.push(`Acceptance criterion ${id} is not linked to any verification entry`);
  }

  return { ok: errors.length === 0, errors, matrix };
}
