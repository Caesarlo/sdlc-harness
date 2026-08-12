import path from 'node:path';
import { writeIfMissing } from '../lib/fs-safe.js';
import { copyDir, copySpecialFiles, TEMPLATES_ROOT } from '../lib/copy-templates.js';

export function runAdopt(targetDir, { projectName } = {}) {
  const data = { projectName: projectName || path.basename(path.resolve(targetDir)) };
  const written = copyDir(path.join(TEMPLATES_ROOT, 'repo'), targetDir, data, writeIfMissing);

  const specialWritten = copySpecialFiles(
    [
      {
        src: path.join(TEMPLATES_ROOT, 'special', 'githooks', 'pre-commit.tmpl'),
        destRelative: path.join(targetDir, '.githooks', 'pre-commit'),
        mode: 0o755,
      },
      {
        src: path.join(TEMPLATES_ROOT, 'special', 'ci', 'deploy.yml.tmpl'),
        destRelative: path.join(targetDir, '.github', 'workflows', 'deploy.yml'),
      },
    ],
    data,
    (destRelative, content, opts) => writeIfMissing(destRelative, content, opts),
  );

  return [...written, ...specialWritten];
}
