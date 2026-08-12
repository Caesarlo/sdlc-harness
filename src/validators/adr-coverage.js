import fs from 'node:fs';
import path from 'node:path';

export function validateAdrCoverage(config, adrDir) {
  const errors = [];
  const requiredTopics = config.requiredAdrTopics || [];
  if (requiredTopics.length === 0) return { ok: true, errors };

  if (!fs.existsSync(adrDir)) {
    errors.push(`ADR directory not found: ${adrDir}`);
    return { ok: false, errors };
  }

  const files = fs.readdirSync(adrDir).filter((f) => f.endsWith('.md'));
  const coveredTopics = new Set();
  for (const file of files) {
    const content = fs.readFileSync(path.join(adrDir, file), 'utf8');
    const match = content.match(/^topic:\s*(.+)$/m);
    if (match) coveredTopics.add(match[1].trim());
  }

  for (const topic of requiredTopics) {
    if (!coveredTopics.has(topic)) errors.push(`No ADR covers required topic: ${topic}`);
  }

  return { ok: errors.length === 0, errors };
}
