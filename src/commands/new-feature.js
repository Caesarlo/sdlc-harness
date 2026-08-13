import path from 'node:path';
import readline from 'node:readline/promises';
import { createAsker } from '../lib/prompt.js';
import { loadFeatureList } from '../lib/load-feature-list.js';
import { readJsonWithStamp, writeJsonCas, RevisionConflictError } from '../lib/atomic-write.js';
import { appendEvent } from '../lib/events.js';

export async function runNewFeature(repoRoot, { input = process.stdin, output = process.stdout } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  loadFeatureList(repoRoot); // validates the file exists and parses before prompting
  const rl = readline.createInterface({ input, output });
  const ask = createAsker(rl, output);

  try {
    // Snapshot is taken before the prompts start, so the CAS check at write
    // time can detect a concurrent writer that landed while this session was
    // waiting on interactive input.
    let { data, stamp } = readJsonWithStamp(featureListPath);
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
    try {
      writeJsonCas(featureListPath, data, stamp);
    } catch (err) {
      if (!(err instanceof RevisionConflictError)) throw err;
      // Another process changed feature_list.json while we were prompting or
      // writing. Retry once against the fresh file instead of silently
      // clobbering the other writer's change.
      const reread = readJsonWithStamp(featureListPath);
      if (reread.data.features.some((f) => f.id === id)) {
        throw new Error(`Feature id already exists: ${id} (created concurrently by another process)`);
      }
      reread.data.features.push(feature);
      writeJsonCas(featureListPath, reread.data, reread.stamp);
    }
    appendEvent(repoRoot, { type: 'feature.created', feature_id: feature.id, milestone: feature.milestone });
    return feature;
  } finally {
    rl.close();
  }
}
