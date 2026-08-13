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
};

const TEST_STRATEGIES = ['isolated-tdd', 'in-session-tdd', 'team-default'];
const COLLABORATION_MODES = ['solo', 'team'];

export function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const config = { ...DEFAULT_CONFIG, ...raw };
  if (!TEST_STRATEGIES.includes(config.testStrategy)) {
    throw new Error(`harness.config.json: testStrategy must be one of ${TEST_STRATEGIES.join(', ')}, got "${config.testStrategy}"`);
  }
  if (!COLLABORATION_MODES.includes(config.collaborationMode)) {
    throw new Error(`harness.config.json: collaborationMode must be one of ${COLLABORATION_MODES.join(', ')}, got "${config.collaborationMode}"`);
  }
  return config;
}
