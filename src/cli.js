#!/usr/bin/env node

const [, , command] = process.argv;

function printUsage() {
  console.error(`Unknown command: ${command ?? '(none)'}`);
  console.error('Usage: sdlc-harness <init|adopt|validate|status|new-feature|new-milestone>');
}

async function main() {
  switch (command) {
    default:
      printUsage();
      process.exitCode = 1;
  }
}

main();
