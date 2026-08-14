import fs from 'node:fs';
import path from 'node:path';
import { appendEvent } from '../lib/events.js';

const SEVERITIES = ['S1', 'S2', 'S3', 'S4'];
const DISPOSITIONS = ['Actioned', 'Deferred', 'Declined', 'Monitoring'];
// Disposition values that must say why, per docs/product/feedback-log-template.md's
// own rule ("Deferred — why it's not being acted on now... Declined — why it's not
// being acted on at all"). Structurally enforcing this is the point: a hand-written
// log entry can say "Deferred" and stop there, this command can't.
const DISPOSITIONS_REQUIRING_DETAIL = new Set(['Deferred', 'Declined']);

const LOG_PATH_RELATIVE = path.join('docs', 'product', 'feedback-log.md');
const HEADER = '# Feedback Log\n\n';

function formatEntry({
  date, source, severity, observation, disposition, detail,
}) {
  const dispositionLine = detail ? `${disposition} — ${detail}` : disposition;
  return [
    `- **Date**: ${date}`,
    `  **Source**: ${source}`,
    `  **Severity**: ${severity}`,
    `  **Observation**: ${observation}`,
    `  **Disposition**: ${dispositionLine}`,
  ].join('\n');
}

// Structurally guarantees the shape stage 9 requires (all five fields present, a
// recognized severity, and a disposition that carries its "why" when the template
// says it must) instead of trusting an Agent to hand-write a well-formed Markdown
// bullet list every time. Prepends (log is newest-first, per the template).
export function recordFeedback(repoRoot, {
  date = new Date().toISOString().slice(0, 10),
  source, severity, observation, disposition, detail,
} = {}) {
  if (!source || !source.trim()) throw new Error('A non-empty source is required');
  if (!SEVERITIES.includes(severity)) throw new Error(`Severity must be one of ${SEVERITIES.join(', ')}, got "${severity}"`);
  if (!observation || !observation.trim()) throw new Error('A non-empty observation is required');
  if (!DISPOSITIONS.includes(disposition)) throw new Error(`Disposition must be one of ${DISPOSITIONS.join(', ')}, got "${disposition}"`);
  if (DISPOSITIONS_REQUIRING_DETAIL.has(disposition) && (!detail || !detail.trim())) {
    throw new Error(`Disposition "${disposition}" requires --detail explaining why`);
  }

  const logPath = path.join(repoRoot, LOG_PATH_RELATIVE);
  const existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : HEADER;
  const entry = formatEntry({
    date, source: source.trim(), severity, observation: observation.trim(), disposition, detail: detail?.trim(),
  });

  // Newest-first: insert right after the header block, before any existing entries.
  const headerEnd = existing.indexOf('\n\n') + 2;
  const before = existing.slice(0, headerEnd);
  const rest = existing.slice(headerEnd);
  const updated = `${before}${entry}\n\n${rest}`.replace(/\n{3,}/g, '\n\n');

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, updated, 'utf8');

  appendEvent(repoRoot, {
    type: 'feedback.logged', severity, disposition, source: source.trim(),
  });

  return {
    date, source: source.trim(), severity, observation: observation.trim(), disposition, detail: detail?.trim() || null,
  };
}
