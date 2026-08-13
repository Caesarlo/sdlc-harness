import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const EVENTS_DIR = path.join('.harness', 'events');

// Appends a single audit event as one JSON line to a per-month log file
// (.harness/events/YYYY-MM.jsonl). This is intentionally append-only and
// side-channel to feature_list.json: it records *that* a state change
// happened, it never gets read back to decide current state.
//
// `actor` here is just the OS user — claim/lease (src/lib/claims.js) has its
// own owner/actor_id distinction on the claim record itself; this field is
// a coarser "who ran the CLI" signal and isn't meant to replace that.
//
// Concurrency note: appendFileSync uses the OS append flag, which POSIX
// guarantees is atomic for writes under PIPE_BUF; Windows does not give the
// same cross-process guarantee. Event lines are kept small (single JSON
// object, no embedded newlines) to minimize interleaving risk. This has been
// stress-tested with multiple real concurrent OS processes (see
// test/lib/events-concurrency.test.js) without observed corruption, but that
// is empirical evidence at a given concurrency level, not a correctness
// proof — revisit with a real lock if event volume/concurrency grows a lot.
export function appendEvent(repoRoot, event) {
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const dir = path.join(repoRoot, EVENTS_DIR);
  fs.mkdirSync(dir, { recursive: true });

  const record = {
    event_id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    actor: os.userInfo().username,
    ...event,
  };

  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(path.join(dir, `${monthKey}.jsonl`), line, 'utf8');
  return record;
}

export function readEvents(repoRoot, monthKey) {
  const filePath = path.join(repoRoot, EVENTS_DIR, `${monthKey}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}
