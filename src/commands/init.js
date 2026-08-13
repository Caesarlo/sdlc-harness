import fs from 'node:fs';
import path from 'node:path';
import { writeNew, writeExclusive } from '../lib/fs-safe.js';
import { copyDir, copySpecialFiles, buildSpecialEntries, TEMPLATES_ROOT } from '../lib/copy-templates.js';

export class InitConflictError extends Error {
  constructor(conflicts) {
    super(
      `Refusing to initialize a non-empty repository: ${conflicts.length} file(s) already exist ` +
      `(e.g. ${conflicts[0]}). Use "sdlc-harness adopt" to merge into an existing project, or pass ` +
      '{ force: true } to overwrite.',
    );
    this.name = 'InitConflictError';
    this.conflicts = conflicts;
  }
}

export function runInit(targetDir, { projectName, force = false } = {}) {
  const data = { projectName: projectName || path.basename(path.resolve(targetDir)) };

  // First pass: compute every file init would write, without touching disk,
  // so conflicts can be reported up front instead of leaving a half-written
  // skeleton behind.
  const plan = [];
  const collect = (destPath, content, opts = {}) => {
    plan.push({ destPath, content, opts, exists: fs.existsSync(destPath) });
    return { path: destPath, action: 'planned' };
  };
  copyDir(path.join(TEMPLATES_ROOT, 'repo'), targetDir, data, collect);
  copySpecialFiles(buildSpecialEntries(targetDir), data, (destRelative, content, opts) => collect(destRelative, content, opts));

  const conflicts = plan.filter((entry) => entry.exists).map((entry) => entry.destPath);
  if (conflicts.length && !force) {
    throw new InitConflictError(conflicts);
  }

  // Second pass: write for real. Even with force:true, use the exclusive
  // writer for non-conflicting entries and only fall back to an overwriting
  // write for entries we already know conflict — force never silently
  // overwrites files outside the reported conflict list.
  const conflictSet = new Set(conflicts);
  return plan.map((entry) => {
    const writeFn = conflictSet.has(entry.destPath) ? writeNew : writeExclusive;
    return writeFn(entry.destPath, entry.content, entry.opts);
  });
}
