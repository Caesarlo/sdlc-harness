import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER_PATTERN = /-(SCOPE|RELEASE)-\d+$/;

export function validateStageGate(data, repoRoot) {
  const errors = [];

  for (const feature of data.features) {
    if (PLACEHOLDER_PATTERN.test(feature.id)) continue;

    const refs = feature.source_refs || [];
    if (refs.length === 0) {
      errors.push(`Feature ${feature.id} has no source_refs (must reference an ADR or requirements section)`);
      continue;
    }
    for (const ref of refs) {
      const refPath = ref.split('#')[0];
      const resolved = path.join(repoRoot, refPath);
      if (!fs.existsSync(resolved)) {
        errors.push(`Feature ${feature.id} source_ref does not resolve to a file: ${ref}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
