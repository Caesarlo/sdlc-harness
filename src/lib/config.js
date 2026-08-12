import fs from 'node:fs';

const DEFAULT_CONFIG = {
  projectName: 'unnamed-project',
  requiredAdrTopics: [],
};

export function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return { ...DEFAULT_CONFIG, ...raw };
}
