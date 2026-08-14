import { listArtifactApprovals } from '../commands/artifact-approval.js';

export function validateArtifactApprovals(data, repoRoot) {
  const errors = [];
  for (const approval of listArtifactApprovals(repoRoot, data)) {
    if (!approval.valid) {
      errors.push(`Approval for ${approval.artifact} is stale or its artifact no longer exists; obtain a new human approval`);
    }
  }
  return { ok: errors.length === 0, errors };
}
