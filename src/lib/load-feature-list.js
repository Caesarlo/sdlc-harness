import fs from 'node:fs';
import path from 'node:path';

// Reads and parses feature_list.json from the given repo root, throwing a
// clear, friendly error if the file is missing or malformed.
export function loadFeatureList(repoRoot) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');

  let raw;
  try {
    raw = fs.readFileSync(featureListPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`feature_list.json not found in ${repoRoot} — run "npx sdlc-harness init" first`);
    }
    throw err;
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`feature_list.json is not valid JSON: ${err.message}`);
  }
}
