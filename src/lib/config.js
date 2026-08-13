import fs from 'node:fs';

const DEFAULT_CONFIG = {
  projectName: 'unnamed-project',
  requiredAdrTopics: [],
  testStrategy: 'isolated-tdd',
  defaultOwner: 'agent',
};

const TEST_STRATEGIES = ['isolated-tdd', 'in-session-tdd', 'team-default'];

export function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const config = { ...DEFAULT_CONFIG, ...raw };
  if (!TEST_STRATEGIES.includes(config.testStrategy)) {
    throw new Error(`harness.config.json: testStrategy must be one of ${TEST_STRATEGIES.join(', ')}, got "${config.testStrategy}"`);
  }
  return config;
}
