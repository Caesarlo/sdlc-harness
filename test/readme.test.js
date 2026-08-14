import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const README_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'README.md');

test('README documents every CLI command', () => {
  const content = fs.readFileSync(README_PATH, 'utf8');
  for (const command of [
    'init', 'adopt', 'validate', 'status', 'traceability', 'new-feature', 'new-milestone',
    'feature start', 'feature complete', 'feature block', 'feature reopen',
    'verify', 'review record', 'claim', 'release', 'workspace',
    'provider github check', 'evidence import', 'evidence manual', 'evidence approval',
    'env check', 'session close', 'feedback log',
  ]) {
    assert.match(content, new RegExp(`sdlc-harness ${command}`));
  }
});

test('README quickstart uses the scoped package and never executes the conflicting unscoped npm package', () => {
  const content = fs.readFileSync(README_PATH, 'utf8');
  assert.match(content, /npx @caesarlo\/sdlc-harness adopt/);
  assert.doesNotMatch(content, /npx sdlc-harness/);
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
