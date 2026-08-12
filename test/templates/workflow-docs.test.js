import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKFLOW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'repo', 'docs', 'workflow');

const REQUIRED_SECTIONS = ['## Inputs', '## What The Agent Does', '## Required Output Artifacts', '## Exit Conditions'];

export function assertStageDocShape(fileName) {
  const content = fs.readFileSync(path.join(WORKFLOW_DIR, fileName), 'utf8');
  for (const section of REQUIRED_SECTIONS) {
    assert.match(content, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${fileName} missing ${section}`);
  }
}

test('01-requirements.md has the required stage-doc shape', () => assertStageDocShape('01-requirements.md'));
test('02-architecture-design.md has the required stage-doc shape', () => assertStageDocShape('02-architecture-design.md'));
test('03-user-stories.md has the required stage-doc shape', () => assertStageDocShape('03-user-stories.md'));
test('04-feature-breakdown.md has the required stage-doc shape', () => assertStageDocShape('04-feature-breakdown.md'));
test('05-milestone-planning.md has the required stage-doc shape', () => assertStageDocShape('05-milestone-planning.md'));
test('06-agile-tdd.md has the required stage-doc shape', () => assertStageDocShape('06-agile-tdd.md'));
test('07-self-acceptance.md has the required stage-doc shape', () => assertStageDocShape('07-self-acceptance.md'));
test('08-deployment.md has the required stage-doc shape', () => assertStageDocShape('08-deployment.md'));
test('09-observability-feedback.md has the required stage-doc shape', () => assertStageDocShape('09-observability-feedback.md'));

test('exactly 9 workflow docs exist', () => {
  const files = fs.readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith('.md'));
  assert.equal(files.length, 9);
});
