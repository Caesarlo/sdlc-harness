import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateAgentsOnboarding } from '../../src/validators/agents-onboarding.js';

test('passes trivially when no sidecar AGENTS.sdlc-harness.md exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const result = validateAgentsOnboarding(dir);
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('fails when a sidecar exists but AGENTS.md does not reference it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM EXISTING CONTENT');
  fs.writeFileSync(path.join(dir, 'AGENTS.sdlc-harness.md'), '# AGENTS.md\n...');

  const result = validateAgentsOnboarding(dir);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /does not reference it/);
});

test('passes once AGENTS.md references the sidecar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'CUSTOM CONTENT\n\nSee AGENTS.sdlc-harness.md for harness rules.');
  fs.writeFileSync(path.join(dir, 'AGENTS.sdlc-harness.md'), '# AGENTS.md\n...');

  const result = validateAgentsOnboarding(dir);
  assert.deepEqual(result, { ok: true, errors: [] });
});
