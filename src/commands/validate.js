import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.js';
import { validateStructural } from '../validators/structural.js';
import { validateDependencyCycles } from '../validators/dependency-cycles.js';
import { validatePassGate } from '../validators/pass-gate.js';
import { validateMilestoneOrder } from '../validators/milestone-order.js';
import { validateAdrCoverage } from '../validators/adr-coverage.js';
import { validateStageGate } from '../validators/stage-gate.js';

const SNAPSHOT_RELATIVE_PATH = path.join('.harness', 'last-validated-features.json');

export function runValidate(repoRoot) {
  const data = JSON.parse(fs.readFileSync(path.join(repoRoot, 'feature_list.json'), 'utf8'));
  const config = loadConfig(path.join(repoRoot, 'harness.config.json'));
  const snapshotPath = path.join(repoRoot, SNAPSHOT_RELATIVE_PATH);
  const previousSnapshot = fs.existsSync(snapshotPath)
    ? JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    : null;

  const namedResults = [
    ['structural', validateStructural(data)],
    ['dependency-cycles', validateDependencyCycles(data)],
    ['pass-gate', validatePassGate(data, previousSnapshot)],
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
