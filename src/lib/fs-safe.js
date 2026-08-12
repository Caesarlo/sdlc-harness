import fs from 'node:fs';
import path from 'node:path';

export function writeNew(targetPath, content, opts = {}) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
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
