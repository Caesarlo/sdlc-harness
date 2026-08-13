import fs from 'node:fs';
import path from 'node:path';

// Resolves a repo-relative reference path and confirms it stays within
// repoRoot after symlink/`..`/case resolution. Returns the resolved absolute
// path, or null if the ref is unsafe or does not exist.
export function resolveSafeRepoPath(repoRoot, refPath) {
  if (!refPath || refPath.includes('\0')) return null;
  if (path.isAbsolute(refPath)) return null;

  const root = path.resolve(repoRoot);
  const target = path.resolve(root, refPath);

  // Reject before touching the filesystem if the lexical resolution already
  // escapes the root (handles targets that don't exist yet, and short-circuits
  // obvious `..` escapes without a filesystem round-trip).
  if (!isWithin(root, target)) return null;

  if (!fs.existsSync(target)) return null;

  // Resolve symlinks on both sides so a symlink inside the repo that points
  // outside it can't be used to escape the containment check above, and so
  // Windows short (8.3) names or case differences don't bypass it either.
  let realTarget;
  let realRoot;
  try {
    realTarget = fs.realpathSync(target);
    realRoot = fs.realpathSync(root);
  } catch {
    return null;
  }
  if (!isWithin(realRoot, realTarget)) return null;

  return realTarget;
}

function isWithin(root, target) {
  const normRoot = process.platform === 'win32' ? root.toLowerCase() : root;
  const normTarget = process.platform === 'win32' ? target.toLowerCase() : target;
  const rootWithSep = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep;
  return normTarget === normRoot || normTarget.startsWith(rootWithSep);
}
