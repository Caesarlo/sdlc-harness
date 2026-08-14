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
  assert.match(content, /npx @caesarlo\/sdlc-harness validate/);
});

test('deploy.yml.tmpl renders with the project name and runs validate before deploying', () => {
  const rendered = renderFile(path.join(TEMPLATES_ROOT, 'special', 'ci', 'deploy.yml.tmpl'), { projectName: 'demo' });
  assert.match(rendered, /demo/);
  assert.match(rendered, /npx @caesarlo\/sdlc-harness validate/);
  assert.match(rendered, /needs: validate-harness/);
});

test('deploy.yml.tmpl and ci.yml.tmpl pin GitHub Actions to a full commit SHA, not a movable tag', () => {
  for (const name of ['ci.yml.tmpl', 'deploy.yml.tmpl']) {
    const content = fs.readFileSync(path.join(TEMPLATES_ROOT, 'special', 'ci', name), 'utf8');
    // Every `uses:` line must reference a 40-hex-char commit SHA, not @v4 or similar.
    const usesLines = content.match(/^\s*- uses: .+$/gm) || [];
    assert.ok(usesLines.length > 0, `expected at least one 'uses:' step in ${name}`);
    for (const line of usesLines) {
      assert.match(line, /@[0-9a-f]{40}/, `expected a full commit SHA in: ${line}`);
    }
  }
});

test('ci.yml.tmpl and deploy.yml.tmpl fail closed instead of echoing fake success for unconfigured steps', () => {
  const ci = fs.readFileSync(path.join(TEMPLATES_ROOT, 'special', 'ci', 'ci.yml.tmpl'), 'utf8');
  const deploy = fs.readFileSync(path.join(TEMPLATES_ROOT, 'special', 'ci', 'deploy.yml.tmpl'), 'utf8');

  for (const content of [ci, deploy]) {
    // No step may be a bare `echo ...` with nothing that would fail the job —
    // every placeholder step must exit non-zero until it's replaced with a
    // real command, otherwise the workflow can go green without checking
    // anything.
    const bareEchoSuccess = /run: echo "[^"]*"\s*$/m;
    assert.doesNotMatch(content, bareEchoSuccess);
    assert.match(content, /exit 1/);
  }
});
