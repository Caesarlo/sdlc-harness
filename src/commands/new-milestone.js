import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createAsker } from '../lib/prompt.js';
import { loadFeatureList } from '../lib/load-feature-list.js';

export async function runNewMilestone(repoRoot, { input = process.stdin, output = process.stdout } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const data = loadFeatureList(repoRoot);
  const rl = readline.createInterface({ input, output });
  const ask = createAsker(rl, output);

  try {
    const id = (await ask('Milestone id: ')).trim();
    if (data.milestones.some((m) => m.id === id)) {
      throw new Error(`Milestone id already exists: ${id}`);
    }
    const title = (await ask('Title: ')).trim();
    const objective = (await ask('Objective: ')).trim();

    const milestone = { id, title, objective };
    data.milestones.push(milestone);
    fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');
    return milestone;
  } finally {
    rl.close();
  }
}
