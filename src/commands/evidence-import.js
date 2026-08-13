import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readJsonWithStamp, writeJsonCas, RevisionConflictError } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';
import { FeatureNotFoundError } from '../lib/errors.js';

export { FeatureNotFoundError };

export class CiRunNotVerifiableError extends Error {
  constructor(runId, reason) {
    super(`Could not verify CI run ${runId} with the provider: ${reason}`);
    this.name = 'CiRunNotVerifiableError';
    this.runId = runId;
  }
}

export class CiRunNotSuccessfulError extends Error {
  constructor(runId, status, conclusion) {
    super(`CI run ${runId} is not a successful completed run (status=${status}, conclusion=${conclusion}) — refusing to import it as evidence`);
    this.name = 'CiRunNotSuccessfulError';
    this.runId = runId;
    this.status = status;
    this.conclusion = conclusion;
  }
}

function defaultRunGh(args) {
  return spawnSync('gh', args, { encoding: 'utf8' });
}

// Imports evidence from a GitHub Actions run, but only after independently
// confirming with the provider's API that the run actually exists,
// completed, and succeeded — the caller supplies a run id, nothing else
// about the run is trusted. This is the anti-forgery requirement from the
// architecture review: a hand-written evidence JSON claiming a CI run
// passed must never be accepted at face value.
export function runEvidenceImport(repoRoot, featureId, { owner, repo, runId, runGh = defaultRunGh } = {}) {
  const apiResult = runGh(['api', `repos/${owner}/${repo}/actions/runs/${runId}`]);
  if (apiResult.status !== 0) {
    throw new CiRunNotVerifiableError(runId, (apiResult.stderr || apiResult.stdout || '').trim());
  }

  let run;
  try {
    run = JSON.parse(apiResult.stdout);
  } catch {
    throw new CiRunNotVerifiableError(runId, 'provider returned a response that could not be parsed');
  }

  if (run.status !== 'completed' || run.conclusion !== 'success') {
    throw new CiRunNotSuccessfulError(runId, run.status, run.conclusion);
  }

  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const { data, stamp } = readJsonWithStamp(featureListPath);
  const feature = data.features.find((f) => f.id === featureId);
  if (!feature) throw new FeatureNotFoundError(featureId);

  const evidenceEntry = {
    kind: 'test',
    command: run.name || run.display_title || `ci-run-${runId}`,
    result: 'passed',
    recorded_at: new Date().toISOString(),
    commit_sha: run.head_sha,
    ci: { provider: 'github', run_id: String(runId), html_url: run.html_url || null },
  };

  function applyEvidence(targetData) {
    const targetFeature = targetData.features.find((f) => f.id === featureId);
    if (!targetFeature) throw new FeatureNotFoundError(featureId);
    targetFeature.evidence = [...(targetFeature.evidence || []), evidenceEntry];
  }

  applyEvidence(data);
  try {
    writeJsonCas(featureListPath, data, stamp);
  } catch (err) {
    if (!(err instanceof RevisionConflictError)) throw err;
    const reread = readJsonWithStamp(featureListPath);
    applyEvidence(reread.data);
    writeJsonCas(featureListPath, reread.data, reread.stamp);
  }

  appendEvent(repoRoot, {
    type: 'evidence.imported', feature_id: featureId, run_id: String(runId), commit_sha: run.head_sha,
  });

  return evidenceEntry;
}
