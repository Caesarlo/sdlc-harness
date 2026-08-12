import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const README_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'README.md');

test('README documents every CLI command', () => {
  const content = fs.readFileSync(README_PATH, 'utf8');
  for (const command of ['init', 'adopt', 'validate', 'status', 'new-feature', 'new-milestone']) {
    assert.match(content, new RegExp(`sdlc-harness ${command}`));
  }
});

test('README lists all 9 stages by name', () => {
  const content = fs.readFileSync(README_PATH, 'utf8');
  for (const stage of [
    'Requirements', 'Architecture', 'User Stor', 'Feature Breakdown',
    'Milestone Planning', 'Agile Development', 'Self-Acceptance', 'Deployment',
    'Observability',
  ]) {
    assert.match(content, new RegExp(stage));
  }
});
