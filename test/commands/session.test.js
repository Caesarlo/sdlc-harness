import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runSessionClose } from '../../src/commands/session.js';
import { readEvents } from '../../src/lib/events.js';

function seedRepo(dir, { commands = {}, featureListOverrides = {} } = {}) {
  fs.mkdirSync(path.join(dir, 'docs', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'harness.config.json'), JSON.stringify({ projectName: 'demo', requiredAdrTopics: [], commands }));
  const data = {
    project: 'demo',
    schema_version: '1.0',
    milestones: [{ id: 'M0', title: 'Bootstrap', objective: 'x' }],
    features: [{
      id: 'M0-SCOPE-001',
      milestone: 'M0',
      behavior: 'does a thing',
      status: 'not_started',
      dependencies: [],
      verification: [{ type: 'automated', command: 'test', expected: 'pass' }],
      evidence: [],
      source_refs: [],
      ...featureListOverrides,
    }],
  };
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify(data));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
  return dir;
}

test('session close reports ok when validate passes and no env commands are configured', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir);

  const result = runSessionClose(dir);
  assert.equal(result.validate.ok, true);
  assert.equal(result.env.configured, false);
  assert.equal(result.ok, true);
  // validate's own snapshot write (.harness/last-validated-features.json)
  // leaves the tree dirty in this from-scratch repo (no .gitignore here) —
  // git.clean isn't asserted for that reason; commitSha is what matters.
  assert.ok(result.git.commitSha);

  const monthKey = new Date().toISOString().slice(0, 7);
  const events = readEvents(dir, monthKey);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'session.closed');
  assert.equal(events[0].ok, true);
});

test('session close fails when a configured environment command fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, { commands: { health: 'node -e "process.exit(1)"' } });

  const result = runSessionClose(dir);
  assert.equal(result.validate.ok, true);
  assert.equal(result.env.configured, true);
  assert.equal(result.env.ok, false);
  assert.equal(result.ok, false);
});

test('session close fails when validate fails, even if env commands pass', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir, {
    commands: { health: 'node -e "process.exit(0)"' },
    featureListOverrides: { status: 'passing', evidence: [] },
  });

  const result = runSessionClose(dir);
  assert.equal(result.validate.ok, false);
  assert.equal(result.env.ok, true);
  assert.equal(result.ok, false);
});

test('session close reports uncommitted changes without treating them as failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  seedRepo(dir);
  fs.writeFileSync(path.join(dir, 'scratch.txt'), 'wip');

  const result = runSessionClose(dir);
  assert.equal(result.git.clean, false);
  assert.equal(result.ok, true);
});
