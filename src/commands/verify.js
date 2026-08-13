import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readJsonWithStamp, writeJsonCas, RevisionConflictError } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';
import { FeatureNotFoundError } from '../lib/errors.js';

export { FeatureNotFoundError };

function currentCommitSha(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) return null;
  return result.stdout.trim();
}

function runOneVerification(repoRoot, verification, exec) {
  const result = exec(verification.command, { cwd: repoRoot, shell: true, encoding: 'utf8' });
  return {
    command: verification.command,
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// The only code path allowed to append "test" evidence: it actually runs
// each declared verification command against the repo, rather than trusting
// a hand-written evidence entry claiming a command passed. Evidence records
// the real exit code and current commit sha so a later reviewer can tell
// whether it still applies to the commit under review.
//
// `exec` defaults to child_process.spawnSync and exists as an injection
// point for tests that need to simulate side effects (like a concurrent
// writer) happening exactly when a verification command runs.
export function runVerify(repoRoot, featureId, { exec = spawnSync } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const { data, stamp } = readJsonWithStamp(featureListPath);

  const feature = data.features.find((f) => f.id === featureId);
  if (!feature) throw new FeatureNotFoundError(featureId);

  const verifications = feature.verification || [];
  const results = verifications.map((v) => runOneVerification(repoRoot, v, exec));
  const ok = results.length > 0 && results.every((r) => r.exitCode === 0);
  const commitSha = currentCommitSha(repoRoot);
  const recordedAt = new Date().toISOString();

  const newEvidence = results.map((r) => ({
    kind: 'test',
    command: r.command,
    result: r.exitCode === 0 ? 'passed' : 'failed',
    recorded_at: recordedAt,
    exit_code: r.exitCode,
    commit_sha: commitSha,
  }));

  function applyEvidence(targetData) {
    const targetFeature = targetData.features.find((f) => f.id === featureId);
    if (!targetFeature) throw new FeatureNotFoundError(featureId);
    targetFeature.evidence = [...(targetFeature.evidence || []), ...newEvidence];
  }

  applyEvidence(data);
  try {
    writeJsonCas(featureListPath, data, stamp);
  } catch (err) {
    if (!(err instanceof RevisionConflictError)) throw err;
    // Another process changed feature_list.json while the verification
    // commands were running. Retry once against the fresh file so we don't
    // clobber the other writer's change with our (still accurate) results.
    const reread = readJsonWithStamp(featureListPath);
    applyEvidence(reread.data);
    writeJsonCas(featureListPath, reread.data, reread.stamp);
  }

  appendEvent(repoRoot, {
    type: 'feature.verified',
    feature_id: featureId,
    ok,
    commit_sha: commitSha,
    commands: results.map((r) => ({ command: r.command, exit_code: r.exitCode })),
  });

  return { ok, featureId, results };
}
