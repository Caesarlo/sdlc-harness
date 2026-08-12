import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderString } from './render-template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_ROOT = path.join(__dirname, '..', '..', 'templates');

export function copyDir(srcDir, destDir, data, writeFn) {
  const written = [];
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      written.push(...copyDir(srcPath, path.join(destDir, entry.name), data, writeFn));
      continue;
    }
    const isTemplate = entry.name.endsWith('.tmpl');
    const destName = isTemplate ? entry.name.replace(/\.tmpl$/, '') : entry.name;
    const destPath = path.join(destDir, destName);
    const raw = fs.readFileSync(srcPath, 'utf8');
    const content = isTemplate ? renderString(raw, data) : raw;
    written.push(writeFn(destPath, content));
  }
  return written;
}

export function copySpecialFiles(entries, data, writeFn) {
  const written = [];
  for (const { src, destRelative, mode } of entries) {
    const raw = fs.readFileSync(src, 'utf8');
    const content = src.endsWith('.tmpl') ? renderString(raw, data) : raw;
    written.push(writeFn(destRelative, content, mode ? { mode } : {}));
  }
  return written;
}
