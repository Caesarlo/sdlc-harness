import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.js';
import { validateSchema } from '../validators/schema.js';
import { validateStructural } from '../validators/structural.js';
import { validateDependencyCycles } from '../validators/dependency-cycles.js';
import { validatePassGate } from '../validators/pass-gate.js';
import { validateDependencyReadiness } from '../validators/dependency-readiness.js';
import { validateMilestoneOrder } from '../validators/milestone-order.js';
import { validateAdrCoverage } from '../validators/adr-coverage.js';
import { validateStageGate } from '../validators/stage-gate.js';
import { validateAgentsOnboarding } from '../validators/agents-onboarding.js';
import { validateFeedbackLog } from '../validators/feedback-log.js';
import { validateArtifactApprovals } from '../validators/artifact-approval.js';
import { validateTraceability } from '../validators/traceability.js';
import { readFeatureListAtRef, resolveBaseRef } from '../lib/git-baseline.js';

const SNAPSHOT_RELATIVE_PATH = path.join('.harness', 'last-validated-features.json');

export function runValidate(repoRoot) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(repoRoot, 'feature_list.json'), 'utf8'));
  } catch (err) {
    return { ok: false, errors: [`feature_list.json: ${err.message}`] };
  }

  const config = loadConfig(path.join(repoRoot, 'harness.config.json'));

  // The passing_is_monotonic baseline prefers git history over the local
  // .harness/ snapshot cache: the snapshot is gitignored and doesn't exist
  // on a fresh CI checkout, so relying on it alone means a regression PR
  // that deletes/reverts a passing feature would sail through CI with
  // nothing to compare against. Git history survives a fresh checkout (as
  // long as it's fetched — see ci.yml.tmpl's fetch-depth: 0), so it's used
  // whenever a base ref resolves; the local snapshot is the fallback for
  // plain local development where there may be no git history at all yet.
  const baseRef = resolveBaseRef(repoRoot);
  const gitBaseline = baseRef ? readFeatureListAtRef(repoRoot, baseRef) : null;

  const snapshotPath = path.join(repoRoot, SNAPSHOT_RELATIVE_PATH);
  let localSnapshot = null;
  if (fs.existsSync(snapshotPath)) {
    try {
      localSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
      // Corrupted/unreadable snapshot is treated as "no previous snapshot" so a
      // damaged cache file doesn't block validation from proceeding.
      localSnapshot = null;
    }
  }

  const previousSnapshot = gitBaseline || localSnapshot;

  const schemaResult = validateSchema(data, repoRoot);
  if (!schemaResult.ok) {
    return { ok: false, errors: schemaResult.errors.map((error) => `[schema] ${error}`) };
  }

  const structuralResult = validateStructural(data);
  if (!structuralResult.ok) {
    return { ok: false, errors: structuralResult.errors.map((error) => `[structural] ${error}`) };
  }

  const namedResults = [
    ['structural', structuralResult],
    ['dependency-cycles', validateDependencyCycles(data)],
    ['pass-gate', validatePassGate(data, previousSnapshot)],
    ['dependency-readiness', validateDependencyReadiness(data)],
    ['milestone-order', validateMilestoneOrder(data)],
    ['adr-coverage', validateAdrCoverage(config, path.join(repoRoot, 'docs', 'adr'))],
    ['stage-gate', validateStageGate(data, repoRoot)],
    ['agents-onboarding', validateAgentsOnboarding(repoRoot)],
    ['feedback-log', validateFeedbackLog(repoRoot, config)],
    ['artifact-approval', validateArtifactApprovals(data, repoRoot)],
    ['traceability', validateTraceability(data, repoRoot)],
  ];

  const errors = [];
  for (const [name, result] of namedResults) {
    for (const error of result.errors) errors.push(`[${name}] ${error}`);
  }

  if (errors.length === 0) {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify(data, null, 2));
  }

  return { ok: errors.length === 0, errors };
}
