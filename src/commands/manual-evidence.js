import path from 'node:path';
import { casTransaction } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';
import { FeatureNotFoundError } from '../lib/errors.js';
import { currentCommitSha } from '../lib/current-commit.js';

const MANUAL_RESULTS = new Set(['passed', 'failed']);

export function recordManualEvidence(repoRoot, featureId, {
  verificationIndex,
  result,
  notes,
  actor,
} = {}) {
  if (!Number.isInteger(verificationIndex) || verificationIndex < 1) {
    throw new Error('Manual verification index must be a positive, 1-based integer');
  }
  if (!MANUAL_RESULTS.has(result)) throw new Error('Manual verification result must be "passed" or "failed"');
  if (!notes || !notes.trim()) throw new Error('Manual verification notes are required');
  if (!actor) throw new Error('An actor is required for manual verification');

  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const commitSha = currentCommitSha(repoRoot);
  let evidence;

  casTransaction(featureListPath, (data) => {
    const feature = data.features.find((f) => f.id === featureId);
    if (!feature) throw new FeatureNotFoundError(featureId);
    if (feature.status !== 'in_progress') {
      throw new Error(`Feature ${featureId} must be in_progress before manual evidence can be recorded`);
    }
    const verification = (feature.verification || [])[verificationIndex - 1];
    if (!verification) throw new Error(`Feature ${featureId} has no verification at index ${verificationIndex}`);
    if (verification.type !== 'manual') {
      throw new Error(`Verification ${verificationIndex} for ${featureId} is type "${verification.type}", not "manual"`);
    }

    evidence = {
      kind: 'manual',
      verification_index: verificationIndex,
      command: verification.command,
      expected: verification.expected,
      result,
      notes: notes.trim(),
      actor,
      recorded_at: new Date().toISOString(),
      commit_sha: commitSha,
    };
    feature.evidence = [...(feature.evidence || []), evidence];
  });

  appendEvent(repoRoot, {
    type: 'feature.manually_verified',
    feature_id: featureId,
    verification_index: verificationIndex,
    result,
    actor,
    commit_sha: commitSha,
  });
  return evidence;
}
