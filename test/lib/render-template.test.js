import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderString, renderFile } from '../../src/lib/render-template.js';

test('renderString substitutes known variables', () => {
  assert.equal(renderString('Hello {{name}}', { name: 'world' }), 'Hello world');
});

test('renderString throws on unknown variable', () => {
  assert.throws(() => renderString('{{missing}}', {}), /Missing template variable: missing/);
});

test('renderFile reads and renders a file from disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const filePath = path.join(dir, 'sample.tmpl');
  fs.writeFileSync(filePath, 'project: {{projectName}}');
  assert.equal(renderFile(filePath, { projectName: 'demo' }), 'project: demo');
});
