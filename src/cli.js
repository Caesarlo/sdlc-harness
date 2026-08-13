#!/usr/bin/env node
import path from 'node:path';
import { runInit, InitConflictError } from './commands/init.js';
import { runAdopt } from './commands/adopt.js';
import { runValidate } from './commands/validate.js';
import { runStatus } from './commands/status.js';
import { runNewFeature } from './commands/new-feature.js';
import { runNewMilestone } from './commands/new-milestone.js';
import { runVerify, FeatureNotFoundError } from './commands/verify.js';
import { loadConfig } from './lib/config.js';
import {
  claimFeature, claimNextFeature, releaseFeature, renewClaim, takeoverExpiredClaim,
} from './lib/claims.js';

const [, , command, ...rest] = process.argv;
const cwd = process.cwd();

function printUsage() {
  console.error(`Unknown command: ${command ?? '(none)'}`);
  console.error('Usage: sdlc-harness <init|adopt|validate|status|new-feature|new-milestone|verify|claim|release>');
}

function parseClaimArgs(args) {
  const flags = { owner: null, actor: null, ttl: null, next: false, takeoverExpired: false };
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--next') flags.next = true;
    else if (arg === '--takeover-expired') flags.takeoverExpired = true;
    else if (arg === '--owner') flags.owner = args[(i += 1)];
    else if (arg === '--actor') flags.actor = args[(i += 1)];
    else if (arg === '--ttl') flags.ttl = Number(args[(i += 1)]);
    else if (!arg.startsWith('--')) positional.push(arg);
  }
  return { flags, positional };
}

function resolveOwner(explicitOwner) {
  if (explicitOwner) return explicitOwner;
  return loadConfig(path.join(cwd, 'harness.config.json')).defaultOwner;
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
    case 'verify': {
      const featureId = rest.find((arg) => !arg.startsWith('--'));
      if (!featureId) {
        console.error('Usage: sdlc-harness verify <feature-id>');
        process.exitCode = 1;
        return;
      }
      try {
        const result = runVerify(cwd, featureId);
        for (const r of result.results) {
          const label = r.exitCode === 0 ? 'PASS' : 'FAIL';
          console.log(`[${label}] ${r.command} (exit ${r.exitCode})`);
        }
        if (!result.ok) {
          console.error(`Verification failed for ${featureId}.`);
          process.exitCode = 1;
        } else {
          console.log(`All verification commands passed for ${featureId}.`);
        }
      } catch (err) {
        if (err instanceof FeatureNotFoundError) {
          console.error(err.message);
          process.exitCode = 1;
          return;
        }
        throw err;
      }
      break;
    }
    case 'claim': {
      const { flags, positional } = parseClaimArgs(rest);
      const owner = resolveOwner(flags.owner);
      const ttlMinutes = flags.ttl || undefined;

      try {
        if (positional[0] === 'renew') {
          const featureId = positional[1];
          if (!featureId) {
            console.error('Usage: sdlc-harness claim renew <feature-id>');
            process.exitCode = 1;
            return;
          }
          renewClaim(cwd, featureId, { owner, ttlMinutes });
          console.log(`Renewed claim on ${featureId} for ${owner}.`);
          break;
        }
        if (flags.next) {
          const claim = claimNextFeature(cwd, { owner, actorId: flags.actor, ttlMinutes });
          console.log(`Claimed ${claim.feature_id} for ${owner} (lease until ${claim.lease_until}).`);
          break;
        }
        const featureId = positional[0];
        if (!featureId) {
          console.error('Usage: sdlc-harness claim <feature-id> | claim --next | claim renew <feature-id>');
          process.exitCode = 1;
          return;
        }
        if (flags.takeoverExpired) {
          const claim = takeoverExpiredClaim(cwd, featureId, { owner, actorId: flags.actor, ttlMinutes });
          console.log(`Took over expired claim on ${featureId} for ${owner} (lease until ${claim.lease_until}).`);
          break;
        }
        const claim = claimFeature(cwd, featureId, { owner, actorId: flags.actor, ttlMinutes });
        console.log(`Claimed ${featureId} for ${owner} (lease until ${claim.lease_until}).`);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
      break;
    }
    case 'release': {
      const { flags, positional } = parseClaimArgs(rest);
      const featureId = positional[0];
      if (!featureId) {
        console.error('Usage: sdlc-harness release <feature-id>');
        process.exitCode = 1;
        return;
      }
      try {
        releaseFeature(cwd, featureId, { owner: resolveOwner(flags.owner) });
        console.log(`Released ${featureId}.`);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
      break;
    }
    default:
      printUsage();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
