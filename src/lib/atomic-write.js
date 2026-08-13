import fs from 'node:fs';
import path from 'node:path';

export class RevisionConflictError extends Error {
  constructor(filePath) {
    super(`${path.basename(filePath)} was modified by another process — reload and retry`);
    this.name = 'RevisionConflictError';
    this.filePath = filePath;
  }
}

// Reads a JSON file along with a snapshot of its current on-disk bytes, so a
// later writeJsonCas call can detect whether another process wrote to the
// same file in between (optimistic concurrency, no long-held lock).
export function readJsonWithStamp(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return { data: JSON.parse(raw), stamp: raw };
}

// Writes `data` to filePath only if the file's bytes still match `expectedStamp`.
// Uses a same-directory temp file + fsync + atomic rename so readers never see
// a partial write, and a re-read-and-compare immediately before the rename to
// close the race window between the caller's original read and this write.
export function writeJsonCas(filePath, data, expectedStamp) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (current !== expectedStamp) {
    throw new RevisionConflictError(filePath);
  }

  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  const content = JSON.stringify(data, null, 2) + '\n';

  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  try {
    // Re-check immediately before the rename to shrink the race window as
    // much as possible (can't eliminate it without a real lock/lease, which
    // is out of scope for this single-file CAS helper).
    const recheck = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (recheck !== expectedStamp) {
      throw new RevisionConflictError(filePath);
    }
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    fs.rmSync(tmpPath, { force: true });
    throw err;
  }
}

// Reads filePath, runs `mutateFn(data)` against it, and writes the result
// back via CAS — retrying by re-reading fresh data and re-running mutateFn
// whenever a RevisionConflictError happens, up to maxAttempts times. This
// matters beyond a naive "retry the same write": mutateFn must re-derive its
// decision from the fresh data each attempt (e.g. re-checking "is this
// already claimed?"), not blindly reapply a stale mutation, since the
// conflicting writer may have changed the very thing the decision depends
// on. Any error mutateFn throws that isn't a RevisionConflictError propagates
// immediately without retrying — it's a domain rejection, not a race.
export function casTransaction(filePath, mutateFn, { maxAttempts = 5 } = {}) {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const { data, stamp } = readJsonWithStamp(filePath);
    const result = mutateFn(data);
    try {
      writeJsonCas(filePath, data, stamp);
      return result;
    } catch (err) {
      if (!(err instanceof RevisionConflictError) || attempt >= maxAttempts) throw err;
    }
  }
}
