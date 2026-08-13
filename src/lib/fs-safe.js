import fs from 'node:fs';
import path from 'node:path';

export function writeNew(targetPath, content, opts = {}) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  if (opts.mode) fs.chmodSync(targetPath, opts.mode);
  return { path: targetPath, action: 'written' };
}

// Fails with EEXIST rather than silently overwriting an existing file.
export function writeExclusive(targetPath, content, opts = {}) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.writeFileSync(targetPath, content, { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') {
      const conflictErr = new Error(`refusing to overwrite existing file: ${targetPath}`);
      conflictErr.code = 'EEXIST';
      conflictErr.targetPath = targetPath;
      throw conflictErr;
    }
    throw err;
  }
  if (opts.mode) fs.chmodSync(targetPath, opts.mode);
  return { path: targetPath, action: 'written' };
}

export function writeIfMissing(targetPath, content, opts = {}) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) {
    return { path: targetPath, action: 'skipped-exists' };
  }
  fs.writeFileSync(targetPath, content, 'utf8');
  if (opts.mode) fs.chmodSync(targetPath, opts.mode);
  return { path: targetPath, action: 'written' };
}
