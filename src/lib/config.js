import fs from 'node:fs';

const DEFAULT_CONFIG = {
  projectName: 'unnamed-project',
  requiredAdrTopics: [],
  testStrategy: 'isolated-tdd',
  defaultOwner: 'agent',
  // 'solo': claim/lease exists underneath but is never surfaced — verify
  // auto-claims before running and auto-releases after, so a single
  // developer/Agent never has to think about it.
  // 'team': commands never manage claims implicitly; the caller is expected
  // to hold a claim already (via `sdlc-harness claim`).
  collaborationMode: 'solo',
  // Defaults preserve the existing always-required behavior for repos that
  // never set these — only projects that opt in get stage 8/9 relaxed.
  deploymentMode: 'required',
  observabilityMode: 'feedback-only',
  // Project-level environment commands (distinct from a feature's own
  // `verification` entries): how to install deps, start the app, run the
  // project's real test/build suite, and check it's actually healthy. All
  // optional — `sdlc-harness env check` skips whichever are unset.
  commands: {},
};

const TEST_STRATEGIES = ['isolated-tdd', 'in-session-tdd', 'team-default'];
const COLLABORATION_MODES = ['solo', 'team'];
const DEPLOYMENT_MODES = ['required', 'optional', 'none'];
const OBSERVABILITY_MODES = ['runtime', 'feedback-only', 'none'];
const COMMAND_KEYS = ['bootstrap', 'start', 'verify', 'e2e', 'health', 'cleanup'];

export function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG, commands: {} };
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const config = { ...DEFAULT_CONFIG, ...raw, commands: { ...raw.commands } };
  if (!TEST_STRATEGIES.includes(config.testStrategy)) {
    throw new Error(`harness.config.json: testStrategy must be one of ${TEST_STRATEGIES.join(', ')}, got "${config.testStrategy}"`);
  }
  if (!COLLABORATION_MODES.includes(config.collaborationMode)) {
    throw new Error(`harness.config.json: collaborationMode must be one of ${COLLABORATION_MODES.join(', ')}, got "${config.collaborationMode}"`);
  }
  if (!DEPLOYMENT_MODES.includes(config.deploymentMode)) {
    throw new Error(`harness.config.json: deploymentMode must be one of ${DEPLOYMENT_MODES.join(', ')}, got "${config.deploymentMode}"`);
  }
  if (!OBSERVABILITY_MODES.includes(config.observabilityMode)) {
    throw new Error(`harness.config.json: observabilityMode must be one of ${OBSERVABILITY_MODES.join(', ')}, got "${config.observabilityMode}"`);
  }
  for (const key of Object.keys(config.commands)) {
    if (!COMMAND_KEYS.includes(key)) {
      throw new Error(`harness.config.json: commands.${key} is not a recognized command (expected one of ${COMMAND_KEYS.join(', ')})`);
    }
  }
  return config;
}

export { COMMAND_KEYS };
