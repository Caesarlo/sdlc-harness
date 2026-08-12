import { test } from 'node:test';
import assert from 'node:assert/strict';
import readline from 'node:readline/promises';
import { Readable, Writable } from 'node:stream';
import { createAsker } from '../../src/lib/prompt.js';

function scriptedInput(lines) {
  return Readable.from([lines.join('\n') + '\n']);
}

function capturingOutput() {
  const chunks = [];
  const output = new Writable({
    write(chunk, enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  output.written = chunks;
  return output;
}

test('createAsker writes the prompt and resolves with the next line', async () => {
  const input = scriptedInput(['first answer', 'second answer']);
  const output = capturingOutput();
  const rl = readline.createInterface({ input, output });

  try {
    const ask = createAsker(rl, output);
    assert.equal(await ask('Q1: '), 'first answer');
    assert.equal(await ask('Q2: '), 'second answer');
    assert.deepEqual(output.written, ['Q1: ', 'Q2: ']);
  } finally {
    rl.close();
  }
});

test('createAsker resolves with an empty string once input is exhausted', async () => {
  const input = scriptedInput(['only answer']);
  const output = capturingOutput();
  const rl = readline.createInterface({ input, output });

  try {
    const ask = createAsker(rl, output);
    assert.equal(await ask('Q1: '), 'only answer');
    assert.equal(await ask('Q2: '), '');
  } finally {
    rl.close();
  }
});
