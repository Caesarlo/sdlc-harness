import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'skills', 'claude-code');

const EXPECTED = [
  ['requirements', '01-requirements.md'],
  ['architecture-design', '02-architecture-design.md'],
  ['user-stories', '03-user-stories.md'],
  ['feature-breakdown', '04-feature-breakdown.md'],
  ['milestone-planning', '05-milestone-planning.md'],
  ['agile-tdd', '06-agile-tdd.md'],
  ['self-acceptance', '07-self-acceptance.md'],
  ['deployment', '08-deployment.md'],
  ['observability-feedback', '09-observability-feedback.md'],
];

for (const [slug, workflowFile] of EXPECTED) {
  test(`${slug} SKILL.md has frontmatter and points at ${workflowFile}`, () => {
    const content = fs.readFileSync(path.join(SKILLS_ROOT, slug, 'SKILL.md'), 'utf8');
    assert.match(content, /^---\nname: /);
    assert.match(content, /description: .+/);
    assert.match(content, new RegExp(`docs/workflow/${workflowFile}`));
    const bodyLines = content.split('---').pop().trim().split('\n').length;
    assert.ok(bodyLines <= 10, `${slug} body has ${bodyLines} lines, expected <= 10`);
  });
}
