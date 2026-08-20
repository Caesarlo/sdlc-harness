import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createAsker } from '../lib/prompt.js';
import { loadFeatureList } from '../lib/load-feature-list.js';
import { readJsonWithStamp, writeJsonCas, RevisionConflictError } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';
import { resolveSafeRepoPath } from '../lib/safe-path.js';
import { validateSchema } from '../validators/schema.js';
import { validateStructural } from '../validators/structural.js';
import { validateDependencyCycles } from '../validators/dependency-cycles.js';
import { validateMilestoneOrder } from '../validators/milestone-order.js';
import { validateStageGate } from '../validators/stage-gate.js';
import { loadArchivedFeatureIds } from '../lib/archive.js';

function normalizeFeature(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Feature input must be a JSON object');
  }
  const feature = raw.feature && typeof raw.feature === 'object' ? raw.feature : raw;
  for (const field of ['id', 'milestone', 'behavior', 'verification']) {
    if (feature[field] === undefined || feature[field] === '') {
      throw new Error(`Feature input is missing required field: ${field}`);
    }
  }
  if (!Array.isArray(feature.verification) || feature.verification.length === 0) {
    throw new Error('Feature input verification must be a non-empty array');
  }
  if (feature.status && feature.status !== 'not_started') {
    throw new Error('A newly created feature must have status "not_started"');
  }
  if (feature.claim || feature.workspace || (feature.evidence || []).length > 0) {
    throw new Error('A newly created feature cannot include claim, workspace, or evidence state');
  }

  return {
    ...feature,
    status: 'not_started',
    dependencies: feature.dependencies || [],
    evidence: [],
    source_refs: feature.source_refs || [],
    implementation: feature.implementation || { files: [], commits: [] },
    blocker: null,
    notes: feature.notes || '',
  };
}

function appendFeature(repoRoot, feature) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  let concurrentRetry = false;

  for (;;) {
    const { data, stamp } = readJsonWithStamp(featureListPath);
    if (data.features.some((candidate) => candidate.id === feature.id)) {
      const suffix = concurrentRetry ? ' (created concurrently by another process)' : '';
      throw new Error(`Feature id already exists: ${feature.id}${suffix}`);
    }
    if (!(data.milestones || []).some((milestone) => milestone.id === feature.milestone)) {
      throw new Error(`Feature ${feature.id} references unknown milestone: ${feature.milestone}`);
    }
    data.features.push(feature);
    try {
      writeJsonCas(featureListPath, data, stamp);
      break;
    } catch (err) {
      if (!(err instanceof RevisionConflictError) || concurrentRetry) throw err;
      concurrentRetry = true;
    }
  }

  appendEvent(repoRoot, { type: 'feature.created', feature_id: feature.id, milestone: feature.milestone });
  return feature;
}

export function runNewFeatureFromFile(repoRoot, inputPath) {
  const current = loadFeatureList(repoRoot);
  const resolved = resolveSafeRepoPath(repoRoot, inputPath);
  if (!resolved) throw new Error(`Feature input must be an existing JSON file inside the repository: ${inputPath}`);

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (err) {
    throw new Error(`Feature input is not valid JSON: ${err.message}`);
  }
  const feature = normalizeFeature(raw);
  const candidate = { ...current, features: [...current.features, feature] };
  const checks = [
    ['schema', validateSchema(candidate, repoRoot)],
    ['structural', validateStructural(candidate)],
    ['dependency-cycles', validateDependencyCycles(candidate, loadArchivedFeatureIds(repoRoot))],
    ['milestone-order', validateMilestoneOrder(candidate)],
    ['stage-gate', validateStageGate(candidate, repoRoot)],
  ];
  const errors = checks.flatMap(([name, result]) => result.errors.map((error) => `[${name}] ${error}`));
  if (errors.length > 0) throw new Error(`Feature input failed validation:\n  - ${errors.join('\n  - ')}`);
  return appendFeature(repoRoot, feature);
}

export async function runNewFeature(repoRoot, { input = process.stdin, output = process.stdout } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  loadFeatureList(repoRoot); // validates the file exists and parses before prompting
  const rl = readline.createInterface({ input, output });
  const ask = createAsker(rl, output);

  try {
    const { data } = readJsonWithStamp(featureListPath);
    const id = (await ask('Feature id: ')).trim();
    if (data.features.some((f) => f.id === id)) {
      throw new Error(`Feature id already exists: ${id}`);
    }
    const milestone = (await ask('Milestone id: ')).trim();
    const title = (await ask('Title: ')).trim();
    const behavior = (await ask('Behavior (observable outcome): ')).trim();
    const owner = (await ask('Owner (blank for the shared default bucket): ')).trim();
    const verificationCommand = (await ask('Verification command: ')).trim();
    const dependenciesRaw = (await ask('Dependencies (comma-separated ids, blank for none): ')).trim();
    const sourceRefsRaw = (await ask('Source refs (comma-separated paths, blank for none): ')).trim();
    const priorityRaw = (await ask('Priority (integer, lower runs first; blank to skip): ')).trim();
    if (priorityRaw && !Number.isInteger(Number(priorityRaw))) {
      throw new Error(`Priority must be an integer, got: ${priorityRaw}`);
    }

    const feature = {
      id,
      milestone,
      title,
      behavior,
      ...(owner ? { owner } : {}),
      ...(priorityRaw ? { priority: Number(priorityRaw) } : {}),
      status: 'not_started',
      dependencies: dependenciesRaw ? dependenciesRaw.split(',').map((s) => s.trim()) : [],
      verification: [{ type: 'automated', command: verificationCommand, expected: '' }],
      evidence: [],
      source_refs: sourceRefsRaw ? sourceRefsRaw.split(',').map((s) => s.trim()) : [],
      implementation: { files: [], commits: [] },
      blocker: null,
      notes: '',
    };

    return appendFeature(repoRoot, feature);
  } finally {
    rl.close();
  }
}
