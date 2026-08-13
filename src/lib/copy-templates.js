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

export function buildSpecialEntries(targetDir) {
  const skillsRoot = path.join(TEMPLATES_ROOT, 'skills', 'claude-code');
  const skills = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      src: path.join(skillsRoot, e.name, 'SKILL.md'),
      destRelative: path.join(targetDir, '.claude', 'skills', e.name, 'SKILL.md'),
    }));

  return [
    { src: path.join(TEMPLATES_ROOT, 'special', 'githooks', 'pre-commit.tmpl'), destRelative: path.join(targetDir, '.githooks', 'pre-commit'), mode: 0o755 },
    { src: path.join(TEMPLATES_ROOT, 'special', 'ci', 'ci.yml.tmpl'), destRelative: path.join(targetDir, '.github', 'workflows', 'ci.yml') },
    { src: path.join(TEMPLATES_ROOT, 'special', 'ci', 'deploy.yml.tmpl'), destRelative: path.join(targetDir, '.github', 'workflows', 'deploy.yml') },
    ...skills,
  ];
}
