import fs from 'node:fs';
import path from 'node:path';

const SEVERITIES = ['S1', 'S2', 'S3', 'S4'];
const DISPOSITIONS = ['Actioned', 'Deferred', 'Declined', 'Monitoring'];
const DISPOSITIONS_REQUIRING_DETAIL = new Set(['Deferred', 'Declined']);

function splitEntries(content) {
  const lines = content.split('\n');
  const entries = [];
  let current = null;
  for (const line of lines) {
    if (/^-\s+\*\*Date\*\*:/.test(line.trim())) {
      if (current) entries.push(current.join('\n'));
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) entries.push(current.join('\n'));
  return entries;
}

function fieldValue(entry, field) {
  const match = entry.match(new RegExp(`\\*\\*${field}\\*\\*:\\s*(.+)`));
  return match ? match[1].trim() : null;
}

// Checks docs/product/feedback-log.md entries have the shape stage 9 requires: every
// field present, a recognized severity, a recognized disposition, and a stated "why"
// for Deferred/Declined (per docs/product/feedback-log-template.md's own rule). Entries
// written via `sdlc-harness feedback log` always pass this; the check exists for
// hand-edited entries that skip a field or leave a Disposition unstated.
export function validateFeedbackLog(repoRoot, config) {
  if (config.observabilityMode === 'none') return { ok: true, errors: [] };

  const logPath = path.join(repoRoot, 'docs', 'product', 'feedback-log.md');
  if (!fs.existsSync(logPath)) return { ok: true, errors: [] };

  const content = fs.readFileSync(logPath, 'utf8');
  const entries = splitEntries(content);
  const errors = [];

  entries.forEach((entry, index) => {
    const label = `feedback-log entry ${index + 1}`;
    const date = fieldValue(entry, 'Date');
    const source = fieldValue(entry, 'Source');
    const severity = fieldValue(entry, 'Severity');
    const observation = fieldValue(entry, 'Observation');
    const disposition = fieldValue(entry, 'Disposition');

    if (!date) errors.push(`${label}: missing Date`);
    if (!source) errors.push(`${label}: missing Source`);
    if (!observation) errors.push(`${label}: missing Observation`);
    if (!severity) {
      errors.push(`${label}: missing Severity`);
    } else if (!SEVERITIES.includes(severity)) {
      errors.push(`${label}: Severity "${severity}" must be one of ${SEVERITIES.join(', ')}`);
    }
    if (!disposition) {
      errors.push(`${label}: missing Disposition — silence isn't a valid outcome for a logged entry`);
    } else {
      const dispositionKind = disposition.split(/[—-]/)[0].trim();
      if (!DISPOSITIONS.includes(dispositionKind)) {
        errors.push(`${label}: Disposition "${dispositionKind}" must be one of ${DISPOSITIONS.join(', ')}`);
      } else if (DISPOSITIONS_REQUIRING_DETAIL.has(dispositionKind) && !/[—-]\s*\S/.test(disposition)) {
        errors.push(`${label}: Disposition "${dispositionKind}" must state why (e.g. "Deferred — <reason>")`);
      }
    }
  });

  return { ok: errors.length === 0, errors };
}
