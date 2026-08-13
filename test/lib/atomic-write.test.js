import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJsonWithStamp, writeJsonCas, RevisionConflictError } from '../../src/lib/atomic-write.js';

function tmpFile(initial) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-cas-'));
  const filePath = path.join(dir, 'feature_list.json');
  fs.writeFileSync(filePath, JSON.stringify(initial, null, 2) + '\n');
  return filePath;
}

test('writeJsonCas writes when the stamp still matches', () => {
  const filePath = tmpFile({ features: [] });
  const { data, stamp } = readJsonWithStamp(filePath);
  data.features.push({ id: 'a' });
  writeJsonCas(filePath, data, stamp);

  const after = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(after.features, [{ id: 'a' }]);
});

test('writeJsonCas throws RevisionConflictError when the file changed since the stamp was taken', () => {
  const filePath = tmpFile({ features: [] });
  const { data, stamp } = readJsonWithStamp(filePath);

  // Simulate a concurrent writer landing between the read and this write.
  const concurrent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  concurrent.features.push({ id: 'from-other-process' });
  fs.writeFileSync(filePath, JSON.stringify(concurrent, null, 2) + '\n');

  data.features.push({ id: 'from-us' });
  assert.throws(() => writeJsonCas(filePath, data, stamp), RevisionConflictError);

  // The concurrent writer's change must survive — our stale write must not
  // have clobbered it despite the thrown error.
  const after = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(after.features, [{ id: 'from-other-process' }]);
});

test('writeJsonCas leaves no leftover temp file behind after a conflict', () => {
  const filePath = tmpFile({ features: [] });
  const { data, stamp } = readJsonWithStamp(filePath);
  fs.writeFileSync(filePath, JSON.stringify({ features: [{ id: 'x' }] }, null, 2) + '\n');

  assert.throws(() => writeJsonCas(filePath, data, stamp));

  const dirEntries = fs.readdirSync(path.dirname(filePath));
  assert.deepEqual(dirEntries, ['feature_list.json']);
});
