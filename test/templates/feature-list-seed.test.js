import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderString } from '../../src/lib/render-template.js';
import { validateStructural } from '../../src/validators/structural.js';
import { validateDependencyCycles } from '../../src/validators/dependency-cycles.js';
import { validatePassGate } from '../../src/validators/pass-gate.js';
import { validateMilestoneOrder } from '../../src/validators/milestone-order.js';
import { validateAdrCoverage } from '../../src/validators/adr-coverage.js';
import { validateStageGate } from '../../src/validators/stage-gate.js';

const TEMPLATES_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'repo');

test('the rendered seed feature_list passes every validator', () => {
  const raw = fs.readFileSync(path.join(TEMPLATES_ROOT, 'feature_list.json.tmpl'), 'utf8');
  const rendered = renderString(raw, { projectName: 'demo-project' });
  const data = JSON.parse(rendered);

  for (const result of [
    validateStructural(data),
    validateDependencyCycles(data),
    validatePassGate(data, null),
    validateMilestoneOrder(data),
    validateAdrCoverage({ requiredAdrTopics: [] }, '/nonexistent'),
    validateStageGate(data, '/nonexistent-repo-root'),
  ]) {
    assert.deepEqual(result, { ok: true, errors: [] });
  }
});

test('the schema file is valid JSON', () => {
  const raw = fs.readFileSync(path.join(TEMPLATES_ROOT, 'feature_list.schema.json'), 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw));
});
