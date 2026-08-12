import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFile } from '../../src/lib/render-template.js';

const TEMPLATES_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates');

test('ADR template documents the topic field used by adr-coverage', () => {
  const content = fs.readFileSync(path.join(TEMPLATES_ROOT, 'repo', 'docs', 'adr', 'template.md'), 'utf8');
  assert.match(content, /^topic:/m);
  assert.match(content, /## Decision/);
  assert.match(content, /## Consequences/);
});

test('pre-commit hook invokes sdlc-harness validate', () => {
  const content = fs.readFileSync(path.join(TEMPLATES_ROOT, 'special', 'githooks', 'pre-commit.tmpl'), 'utf8');
  assert.match(content, /npx sdlc-harness validate/);
});

test('deploy.yml.tmpl renders with the project name and runs validate before deploying', () => {
  const rendered = renderFile(path.join(TEMPLATES_ROOT, 'special', 'ci', 'deploy.yml.tmpl'), { projectName: 'demo' });
  assert.match(rendered, /demo/);
  assert.match(rendered, /npx sdlc-harness validate/);
  assert.match(rendered, /needs: validate-harness/);
});
