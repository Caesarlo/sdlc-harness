import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../src/lib/config.js';

test('loadConfig returns defaults when file is missing', () => {
  const config = loadConfig(path.join(os.tmpdir(), 'does-not-exist.json'));
  assert.deepEqual(config, {
    projectName: 'unnamed-project',
    requiredAdrTopics: [],
    testStrategy: 'isolated-tdd',
    defaultOwner: 'agent',
    collaborationMode: 'solo',
    deploymentMode: 'required',
    observabilityMode: 'feedback-only',
    commands: {},
  });
});

test('loadConfig merges file contents over defaults', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ projectName: 'demo', requiredAdrTopics: ['data-model'] }));
  const config = loadConfig(configPath);
  assert.deepEqual(config, {
    projectName: 'demo',
    requiredAdrTopics: ['data-model'],
    testStrategy: 'isolated-tdd',
    defaultOwner: 'agent',
    collaborationMode: 'solo',
    deploymentMode: 'required',
    observabilityMode: 'feedback-only',
    commands: {},
  });
});

test('loadConfig rejects an unknown testStrategy', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ testStrategy: 'vibes' }));
  assert.throws(() => loadConfig(configPath), /testStrategy must be one of/);
});

test('loadConfig rejects an unknown collaborationMode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ collaborationMode: 'chaos' }));
  assert.throws(() => loadConfig(configPath), /collaborationMode must be one of/);
});

test('loadConfig accepts collaborationMode: team', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ collaborationMode: 'team' }));
  assert.equal(loadConfig(configPath).collaborationMode, 'team');
});

test('loadConfig rejects an unknown deploymentMode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ deploymentMode: 'sometimes' }));
  assert.throws(() => loadConfig(configPath), /deploymentMode must be one of/);
});

test('loadConfig rejects an unknown observabilityMode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ observabilityMode: 'vibes' }));
  assert.throws(() => loadConfig(configPath), /observabilityMode must be one of/);
});

test('loadConfig accepts deploymentMode: none and observabilityMode: none for libraries/CLIs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ deploymentMode: 'none', observabilityMode: 'none' }));
  const config = loadConfig(configPath);
  assert.equal(config.deploymentMode, 'none');
  assert.equal(config.observabilityMode, 'none');
});

test('loadConfig rejects an unrecognized commands key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ commands: { deploy: 'echo nope' } }));
  assert.throws(() => loadConfig(configPath), /commands\.deploy is not a recognized command/);
});

test('loadConfig passes through recognized command keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  const configPath = path.join(dir, 'harness.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ commands: { bootstrap: 'npm install', health: 'curl -f localhost:3000/health' } }));
  const config = loadConfig(configPath);
  assert.equal(config.commands.bootstrap, 'npm install');
  assert.equal(config.commands.health, 'curl -f localhost:3000/health');
});
