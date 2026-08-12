import path from 'node:path';
import { writeIfMissing } from '../lib/fs-safe.js';
import { copyDir, copySpecialFiles, buildSpecialEntries, TEMPLATES_ROOT } from '../lib/copy-templates.js';

export function runAdopt(targetDir, { projectName } = {}) {
  const data = { projectName: projectName || path.basename(path.resolve(targetDir)) };
  const written = copyDir(path.join(TEMPLATES_ROOT, 'repo'), targetDir, data, writeIfMissing);
  const specialWritten = copySpecialFiles(buildSpecialEntries(targetDir), data, (destRelative, content, opts) => writeIfMissing(destRelative, content, opts));
  return [...written, ...specialWritten];
}
