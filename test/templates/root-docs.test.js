import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFile } from '../../src/lib/render-template.js';

const TEMPLATES_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'repo');

test('AGENTS.md.tmpl renders with required routing and rules', () => {
  const rendered = renderFile(path.join(TEMPLATES_ROOT, 'AGENTS.md.tmpl'), { projectName: 'demo' });
  assert.match(rendered, /npx sdlc-harness validate/);
  assert.match(rendered, /git config core\.hooksPath \.githooks/);
  assert.match(rendered, /kind: "review"/);
  for (let i = 1; i <= 9; i++) {
    const n = String(i).padStart(2, '0');
    assert.match(rendered, new RegExp(`docs/workflow/${n}-`));
  }
});

test('progress.md.tmpl renders with project name and session log section', () => {
  const rendered = renderFile(path.join(TEMPLATES_ROOT, 'progress.md.tmpl'), { projectName: 'demo' });
  assert.match(rendered, /# demo Progress/);
  assert.match(rendered, /## Session Log/);
});
