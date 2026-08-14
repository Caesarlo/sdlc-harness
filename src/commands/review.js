import path from 'node:path';
import { casTransaction } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';
import { FeatureNotFoundError } from '../lib/errors.js';
import { currentCommitSha } from '../lib/current-commit.js';

const REVIEW_RESULTS = new Set(['passed', 'failed']);

export function recordReview(repoRoot, featureId, {
  reviewer,
  result = 'passed',
  summary,
} = {}) {
  if (!reviewer) throw new Error('A reviewer is required');
  if (!REVIEW_RESULTS.has(result)) throw new Error('Review result must be "passed" or "failed"');
  if (!summary || !summary.trim()) throw new Error('A non-empty review summary is required');

  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const commitSha = currentCommitSha(repoRoot);
  const evidence = {
    kind: 'review',
    result,
    reviewer,
    summary: summary.trim(),
    recorded_at: new Date().toISOString(),
    commit_sha: commitSha,
  };

  casTransaction(featureListPath, (data) => {
    const feature = data.features.find((f) => f.id === featureId);
    if (!feature) throw new FeatureNotFoundError(featureId);
    if (feature.status !== 'in_progress') {
      throw new Error(`Feature ${featureId} must be in_progress before review evidence can be recorded`);
    }
    feature.evidence = [...(feature.evidence || []), evidence];
  });

  appendEvent(repoRoot, {
    type: 'review.recorded',
    feature_id: featureId,
    reviewer,
    result,
    commit_sha: commitSha,
  });
  return evidence;
}
