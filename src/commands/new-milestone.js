import path from 'node:path';
import readline from 'node:readline/promises';
import { createAsker } from '../lib/prompt.js';
import { loadFeatureList } from '../lib/load-feature-list.js';
import { readJsonWithStamp, writeJsonCas, RevisionConflictError } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';

export async function runNewMilestone(repoRoot, { input = process.stdin, output = process.stdout } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  loadFeatureList(repoRoot); // validates the file exists and parses before prompting
  const rl = readline.createInterface({ input, output });
  const ask = createAsker(rl, output);

  try {
    let { data, stamp } = readJsonWithStamp(featureListPath);
    const id = (await ask('Milestone id: ')).trim();
    if (data.milestones.some((m) => m.id === id)) {
      throw new Error(`Milestone id already exists: ${id}`);
    }
    const title = (await ask('Title: ')).trim();
    const objective = (await ask('Objective: ')).trim();

    const milestone = { id, title, objective };
    data.milestones.push(milestone);
    try {
      writeJsonCas(featureListPath, data, stamp);
    } catch (err) {
      if (!(err instanceof RevisionConflictError)) throw err;
      const reread = readJsonWithStamp(featureListPath);
      if (reread.data.milestones.some((m) => m.id === id)) {
        throw new Error(`Milestone id already exists: ${id} (created concurrently by another process)`);
      }
      reread.data.milestones.push(milestone);
      writeJsonCas(featureListPath, reread.data, reread.stamp);
    }
    appendEvent(repoRoot, { type: 'milestone.created', milestone_id: milestone.id });
    return milestone;
  } finally {
    rl.close();
  }
}
