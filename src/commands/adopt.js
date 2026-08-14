import path from 'node:path';
import { writeIfMissing } from '../lib/fs-safe.js';
import { renderFile } from '../lib/render-template.js';
import { copyDir, copySpecialFiles, buildSpecialEntries, TEMPLATES_ROOT } from '../lib/copy-templates.js';

// adopt never touches an existing AGENTS.md's content (a repo's own
// AGENTS.md may carry project-specific instructions no template should
// silently rewrite). But a fresh Agent that only reads the pre-existing
// AGENTS.md would then never learn the harness exists at all — so when
// AGENTS.md was skipped, the harness's own routing/rules content still
// gets written to a side file, and adopt's output tells the caller a
// manual one-line reference is needed to wire it up.
function writeSidecarAgentsFile(targetDir, data, writeFn) {
  const templatePath = path.join(TEMPLATES_ROOT, 'repo', 'AGENTS.md.tmpl');
  const content = renderFile(templatePath, data);
  return writeFn(path.join(targetDir, 'AGENTS.sdlc-harness.md'), content);
}

export function runAdopt(targetDir, { projectName } = {}) {
  const data = { projectName: projectName || path.basename(path.resolve(targetDir)) };
  const written = copyDir(path.join(TEMPLATES_ROOT, 'repo'), targetDir, data, writeIfMissing);
  const specialWritten = copySpecialFiles(buildSpecialEntries(targetDir), data, (destRelative, content, opts) => writeIfMissing(destRelative, content, opts));

  const result = [...written, ...specialWritten];
  const agentsEntry = written.find((w) => w.path === path.join(targetDir, 'AGENTS.md'));
  if (agentsEntry && agentsEntry.action === 'skipped-exists') {
    result.push(writeSidecarAgentsFile(targetDir, data, writeIfMissing));
  }
  return result;
}
