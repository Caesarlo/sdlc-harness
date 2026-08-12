import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.js';
import { validateStructural } from '../validators/structural.js';
import { validateDependencyCycles } from '../validators/dependency-cycles.js';
import { validatePassGate } from '../validators/pass-gate.js';
import { validateDependencyReadiness } from '../validators/dependency-readiness.js';
import { validateMilestoneOrder } from '../validators/milestone-order.js';
import { validateAdrCoverage } from '../validators/adr-coverage.js';
import { validateStageGate } from '../validators/stage-gate.js';

const SNAPSHOT_RELATIVE_PATH = path.join('.harness', 'last-validated-features.json');

export function runValidate(repoRoot) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(repoRoot, 'feature_list.json'), 'utf8'));
  } catch (err) {
    return { ok: false, errors: [`feature_list.json: ${err.message}`] };
  }

  const config = loadConfig(path.join(repoRoot, 'harness.config.json'));
  const snapshotPath = path.join(repoRoot, SNAPSHOT_RELATIVE_PATH);
  let previousSnapshot = null;
  if (fs.existsSync(snapshotPath)) {
    try {
      previousSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
      // Corrupted/unreadable snapshot is treated as "no previous snapshot" so a
      // damaged cache file doesn't block validation from proceeding.
      previousSnapshot = null;
    }
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
