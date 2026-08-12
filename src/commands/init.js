import path from 'node:path';
import { writeNew } from '../lib/fs-safe.js';
import { copyDir, copySpecialFiles, buildSpecialEntries, TEMPLATES_ROOT } from '../lib/copy-templates.js';

export function runInit(targetDir, { projectName } = {}) {
  const data = { projectName: projectName || path.basename(path.resolve(targetDir)) };
  const written = copyDir(path.join(TEMPLATES_ROOT, 'repo'), targetDir, data, writeNew);
  const specialWritten = copySpecialFiles(buildSpecialEntries(targetDir), data, (destRelative, content, opts) => writeNew(destRelative, content, opts));
  return [...written, ...specialWritten];
}
