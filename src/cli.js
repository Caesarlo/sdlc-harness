#!/usr/bin/env node
import { runInit, InitConflictError } from './commands/init.js';
import { runAdopt } from './commands/adopt.js';
import { runValidate } from './commands/validate.js';
import { runStatus } from './commands/status.js';
import { runNewFeature } from './commands/new-feature.js';
import { runNewMilestone } from './commands/new-milestone.js';

const [, , command] = process.argv;
const cwd = process.cwd();

function printUsage() {
  console.error(`Unknown command: ${command ?? '(none)'}`);
  console.error('Usage: sdlc-harness <init|adopt|validate|status|new-feature|new-milestone>');
}

async function main() {
  switch (command) {
    case 'init': {
      const force = process.argv.includes('--force');
      try {
        const written = runInit(cwd, { force });
        console.log(`Wrote ${written.length} files.`);
      } catch (err) {
        if (err instanceof InitConflictError) {
          console.error(err.message);
          console.error('Conflicting files:');
          for (const conflict of err.conflicts) console.error(`  - ${conflict}`);
          process.exitCode = 1;
          return;
        }
        throw err;
      }
      break;
    }
    case 'adopt': {
      const written = runAdopt(cwd);
      const inserted = written.filter((w) => w.action === 'written');
      const skipped = written.filter((w) => w.action === 'skipped-exists');
      console.log(`Inserted ${inserted.length} files, skipped ${skipped.length} existing files.`);
      if (skipped.length) {
        console.log('Existing files left untouched (review manually):');
        for (const w of skipped) console.log(`  - ${w.path}`);
      }
      break;
    }
    case 'validate': {
      const result = runValidate(cwd);
      if (!result.ok) {
        console.error(`FAILED with ${result.errors.length} error(s):`);
        for (const error of result.errors) console.error(`  - ${error}`);
        process.exitCode = 1;
      } else {
        console.log('All checks passed.');
      }
      break;
    }
    case 'status': {
      console.log(JSON.stringify(runStatus(cwd), null, 2));
      break;
    }
    case 'new-feature':
      await runNewFeature(cwd);
      break;
    case 'new-milestone':
      await runNewMilestone(cwd);
      break;
    default:
      printUsage();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
