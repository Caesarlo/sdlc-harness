import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createAsker } from '../lib/prompt.js';
import { loadFeatureList } from '../lib/load-feature-list.js';

export async function runNewFeature(repoRoot, { input = process.stdin, output = process.stdout } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const data = loadFeatureList(repoRoot);
  const rl = readline.createInterface({ input, output });
  const ask = createAsker(rl, output);

  try {
    const id = (await ask('Feature id: ')).trim();
    if (data.features.some((f) => f.id === id)) {
      throw new Error(`Feature id already exists: ${id}`);
    }
    const milestone = (await ask('Milestone id: ')).trim();
    const title = (await ask('Title: ')).trim();
    const behavior = (await ask('Behavior (observable outcome): ')).trim();
    const owner = (await ask('Owner (blank for the shared default bucket): ')).trim();
    const verificationCommand = (await ask('Verification command: ')).trim();
    const dependenciesRaw = (await ask('Dependencies (comma-separated ids, blank for none): ')).trim();
    const sourceRefsRaw = (await ask('Source refs (comma-separated paths, blank for none): ')).trim();

    const feature = {
      id,
      milestone,
      title,
      behavior,
      ...(owner ? { owner } : {}),
      status: 'not_started',
      dependencies: dependenciesRaw ? dependenciesRaw.split(',').map((s) => s.trim()) : [],
      verification: [{ type: 'automated', command: verificationCommand, expected: '' }],
      evidence: [],
      source_refs: sourceRefsRaw ? sourceRefsRaw.split(',').map((s) => s.trim()) : [],
      implementation: { files: [], commits: [] },
      blocker: null,
      notes: '',
    };

    data.features.push(feature);
    fs.writeFileSync(featureListPath, JSON.stringify(data, null, 2) + '\n');
    return feature;
  } finally {
    rl.close();
  }
}
