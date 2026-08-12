// Wraps a readline interface's async iterator to implement prompt-then-read-one-line.
//
// Sequential rl.question() calls throw ERR_USE_AFTER_CLOSE against fully-buffered
// non-TTY input streams on this Node version, so callers must instead pull lines
// from the readline interface's async iterator directly.
export function createAsker(rl, output = rl.output) {
  const lines = rl[Symbol.asyncIterator]();
  return async function ask(prompt) {
    output.write(prompt);
    const { value, done } = await lines.next();
    return done ? '' : value;
  };
}
