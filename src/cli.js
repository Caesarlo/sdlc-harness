#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { runInit, InitConflictError } from './commands/init.js';
import { runAdopt } from './commands/adopt.js';
import { runValidate } from './commands/validate.js';
import { runStatus } from './commands/status.js';
import { runNewFeature, runNewFeatureFromFile } from './commands/new-feature.js';
import { runNewMilestone } from './commands/new-milestone.js';
import { runVerify, FeatureNotFoundError } from './commands/verify.js';
import { loadConfig } from './lib/config.js';
import {
  claimFeature, claimNextFeature, releaseFeature, renewClaim, takeoverExpiredClaim,
} from './lib/claims.js';
import { createWorkspace, removeWorkspace, pruneWorkspaces, listWorkspaces } from './lib/worktree.js';
import { claimAndPush } from './lib/git-provider.js';
import { checkGithubRepoConfig, inferGithubRepoFromRemote } from './lib/github-provider.js';
import { runEvidenceImport } from './commands/evidence-import.js';
import { recordManualEvidence } from './commands/manual-evidence.js';
import { recordReview } from './commands/review.js';
import { startFeature, completeFeature, blockFeature, reopenFeature } from './commands/feature.js';
import { runEnvCheck } from './lib/env-check.js';
import { runSessionClose } from './commands/session.js';
import { recordFeedback } from './commands/feedback.js';
import { recordArtifactApproval } from './commands/artifact-approval.js';
import { buildTraceability } from './lib/traceability.js';

const [, , command, ...rest] = process.argv;
const cwd = process.cwd();

function printUsage({ unknown = false } = {}) {
  const write = unknown ? console.error : console.log;
  if (unknown) write(`Unknown command: ${command ?? '(none)'}`);
  write('Usage: sdlc-harness <init|adopt|validate|status|traceability|new-feature|new-milestone|feature|verify|review|evidence|claim|release|workspace|provider|env|session|feedback>');
  write('Run "sdlc-harness help" or "sdlc-harness --help" to show this message.');
}

function parseValuedArgs(args, valuedFlags) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (valuedFlags.has(arg)) flags[arg] = args[(i += 1)];
    else if (!arg.startsWith('--')) positional.push(arg);
  }
  return { flags, positional };
}

function parseClaimArgs(args) {
  const flags = {
    owner: null, actor: null, ttl: null, next: false, takeoverExpired: false,
    push: false, remote: 'origin', branch: 'main',
  };
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--next') flags.next = true;
    else if (arg === '--takeover-expired') flags.takeoverExpired = true;
    else if (arg === '--push') flags.push = true;
    else if (arg === '--owner') flags.owner = args[(i += 1)];
    else if (arg === '--actor') flags.actor = args[(i += 1)];
    else if (arg === '--ttl') flags.ttl = Number(args[(i += 1)]);
    else if (arg === '--remote') flags.remote = args[(i += 1)];
    else if (arg === '--branch') flags.branch = args[(i += 1)];
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
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;
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
      const sidecar = inserted.find((w) => w.path.endsWith('AGENTS.sdlc-harness.md'));
      if (sidecar) {
        console.log('ACTION REQUIRED: this repo already had an AGENTS.md, so the harness\'s');
        console.log(`routing/rules content was written to ${sidecar.path} instead. Add a`);
        console.log('one-line reference to it from the existing AGENTS.md, or a fresh Agent');
        console.log('session will never discover the harness exists.');
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
    case 'traceability': {
      const data = JSON.parse(fs.readFileSync(path.join(cwd, 'feature_list.json'), 'utf8'));
      const matrix = buildTraceability(cwd, data);
      console.log(JSON.stringify(matrix, null, 2));
      if (!matrix.ok) process.exitCode = 1;
      break;
    }
    case 'new-feature': {
      const { flags } = parseValuedArgs(rest, new Set(['--input']));
      if (flags['--input']) {
        const feature = runNewFeatureFromFile(cwd, flags['--input']);
        console.log(JSON.stringify(feature, null, 2));
      } else {
        await runNewFeature(cwd);
      }
      break;
    }
    case 'new-milestone':
      await runNewMilestone(cwd);
      break;
    case 'feature': {
      const sub = rest[0];
      const { flags, positional } = parseValuedArgs(
        rest.slice(1), new Set(['--owner', '--actor', '--ttl', '--reason']),
      );
      const featureId = positional[0];
      if (!sub || !featureId) {
        console.error('Usage: sdlc-harness feature <start|complete|block|reopen> <feature-id> [options]');
        process.exitCode = 1;
        return;
      }
      const owner = resolveOwner(flags['--owner']);
      try {
        if (sub === 'start') {
          const claim = startFeature(cwd, featureId, {
            owner, actorId: flags['--actor'], ttlMinutes: flags['--ttl'] ? Number(flags['--ttl']) : undefined,
          });
          console.log(`Started ${featureId} for ${owner} (lease until ${claim.lease_until}).`);
        } else if (sub === 'complete') {
          const result = completeFeature(cwd, featureId, { owner });
          console.log(`Completed ${featureId}${result.commitSha ? ` at commit ${result.commitSha}` : ''}.`);
        } else if (sub === 'block') {
          blockFeature(cwd, featureId, { owner, reason: flags['--reason'] });
          console.log(`Blocked ${featureId}: ${flags['--reason']}`);
        } else if (sub === 'reopen') {
          reopenFeature(cwd, featureId, { actor: flags['--actor'] || owner });
          console.log(`Reopened ${featureId}.`);
        } else {
          throw new Error(`Unknown feature command: ${sub}`);
        }
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
      break;
    }
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
    case 'review': {
      if (rest[0] !== 'record') {
        console.error('Usage: sdlc-harness review record <feature-id> --summary <text> [--result passed|failed] [--reviewer <id>]');
        process.exitCode = 1;
        return;
      }
      const { flags, positional } = parseValuedArgs(
        rest.slice(1), new Set(['--summary', '--result', '--reviewer']),
      );
      const featureId = positional[0];
      if (!featureId || !flags['--summary'] || !flags['--reviewer']) {
        console.error('Usage: sdlc-harness review record <feature-id> --reviewer <id> --summary <text> [--result passed|failed]');
        process.exitCode = 1;
        return;
      }
      try {
        const evidence = recordReview(cwd, featureId, {
          reviewer: flags['--reviewer'],
          result: flags['--result'] || 'passed',
          summary: flags['--summary'],
        });
        console.log(`Recorded ${evidence.result} review for ${featureId} by ${evidence.reviewer}.`);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
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
        if (flags.push) {
          // Commits and pushes the claim; if another machine already pushed
          // a claim on the same feature first, this discovers the loss at
          // push time and automatically falls back to the next ready
          // feature instead of leaving the caller with an unpushable claim.
          const result = claimAndPush(cwd, featureId, {
            owner, actorId: flags.actor, ttlMinutes, remote: flags.remote, branch: flags.branch,
          });
          if (result.status === 'claimed-fallback') {
            console.log(`${featureId} was already claimed remotely — claimed ${result.featureId} instead for ${owner} and pushed.`);
          } else {
            console.log(`Claimed ${result.featureId} for ${owner} and pushed.`);
          }
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
    case 'workspace': {
      const sub = rest[0];
      const args = rest.slice(1);
      const force = args.includes('--force');
      const baseIdx = args.indexOf('--base');
      const baseBranch = baseIdx >= 0 ? args[baseIdx + 1] : 'main';
      const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--base');

      try {
        if (sub === 'create') {
          const featureId = positional[0];
          if (!featureId) {
            console.error('Usage: sdlc-harness workspace create <feature-id> [--base <branch>]');
            process.exitCode = 1;
            return;
          }
          const workspace = createWorkspace(cwd, featureId, { baseBranch });
          console.log(`Created workspace for ${featureId} at ${workspace.path} on branch ${workspace.branch}.`);
        } else if (sub === 'remove') {
          const featureId = positional[0];
          if (!featureId) {
            console.error('Usage: sdlc-harness workspace remove <feature-id> [--force]');
            process.exitCode = 1;
            return;
          }
          removeWorkspace(cwd, featureId, { force });
          console.log(`Removed workspace for ${featureId}.`);
        } else if (sub === 'prune') {
          const results = pruneWorkspaces(cwd, { force });
          if (results.length === 0) {
            console.log('Nothing to prune.');
          }
          for (const r of results) {
            console.log(r.action === 'removed' ? `Removed workspace for ${r.featureId}.` : `Skipped ${r.featureId} (${r.reason}) — pass --force to override.`);
          }
        } else if (sub === 'status') {
          console.log(JSON.stringify(listWorkspaces(cwd), null, 2));
        } else {
          console.error('Usage: sdlc-harness workspace <create|remove|prune|status>');
          process.exitCode = 1;
          return;
        }
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
      break;
    }
    case 'provider': {
      if (rest[0] !== 'github' || rest[1] !== 'check') {
        console.error('Usage: sdlc-harness provider github check [--owner <o>] [--repo <r>] [--branch <b>]');
        process.exitCode = 1;
        return;
      }
      const args = rest.slice(2);
      const flagValue = (name) => {
        const idx = args.indexOf(name);
        return idx >= 0 ? args[idx + 1] : null;
      };
      let owner = flagValue('--owner');
      let repo = flagValue('--repo');
      const branch = flagValue('--branch') || 'main';

      if (!owner || !repo) {
        const inferred = inferGithubRepoFromRemote(cwd);
        if (!inferred) {
          console.error('Could not infer owner/repo from git remote "origin" — pass --owner and --repo explicitly.');
          process.exitCode = 1;
          return;
        }
        owner = owner || inferred.owner;
        repo = repo || inferred.repo;
      }

      const result = checkGithubRepoConfig(owner, repo, { branch });
      for (const finding of result.findings) {
        const label = { pass: 'PASS', fail: 'FAIL', unknown: 'UNKNOWN' }[finding.status];
        console.log(`[${label}] ${finding.check}: ${finding.detail}`);
      }
      if (result.degraded) {
        console.log('Some checks could not be verified with this token (need admin access) — treated as warnings, not failures.');
      }
      if (!result.ok) {
        process.exitCode = 1;
      }
      break;
    }
    case 'evidence': {
      if (rest[0] === 'approval') {
        const { flags, positional } = parseValuedArgs(
          rest.slice(1), new Set(['--actor', '--summary']),
        );
        const artifact = positional[0];
        if (!artifact || !flags['--actor'] || !flags['--summary']) {
          console.error('Usage: sdlc-harness evidence approval <artifact> --actor <id> --summary <text>');
          process.exitCode = 1;
          return;
        }
        try {
          const evidence = recordArtifactApproval(cwd, artifact, {
            actor: flags['--actor'], summary: flags['--summary'],
          });
          console.log(`Recorded approval for ${evidence.artifact} by ${evidence.actor} (${evidence.content_hash}).`);
        } catch (err) {
          console.error(err.message);
          process.exitCode = 1;
        }
        break;
      }
      if (rest[0] === 'manual') {
        const { flags, positional } = parseValuedArgs(
          rest.slice(1), new Set(['--verification', '--result', '--notes', '--actor']),
        );
        const featureId = positional[0];
        if (!featureId || !flags['--verification'] || !flags['--result'] || !flags['--notes']) {
          console.error('Usage: sdlc-harness evidence manual <feature-id> --verification <index> --result <passed|failed> --notes <text> [--actor <id>]');
          process.exitCode = 1;
          return;
        }
        try {
          const evidence = recordManualEvidence(cwd, featureId, {
            verificationIndex: Number(flags['--verification']),
            result: flags['--result'],
            notes: flags['--notes'],
            actor: flags['--actor'] || resolveOwner(),
          });
          console.log(`Recorded ${evidence.result} manual verification ${evidence.verification_index} for ${featureId}.`);
        } catch (err) {
          console.error(err.message);
          process.exitCode = 1;
        }
        break;
      }
      if (rest[0] !== 'import') {
        console.error('Usage: sdlc-harness evidence <approval|manual|import> ...');
        process.exitCode = 1;
        return;
      }
      const args = rest.slice(1);
      const VALUED_FLAGS = new Set(['--ci-run', '--owner', '--repo']);
      const flags = {};
      const positional = [];
      for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (VALUED_FLAGS.has(arg)) flags[arg] = args[(i += 1)];
        else if (!arg.startsWith('--')) positional.push(arg);
      }
      const featureId = positional[0];
      const runId = flags['--ci-run'];
      let owner = flags['--owner'];
      let repo = flags['--repo'];

      if (!featureId || !runId) {
        console.error('Usage: sdlc-harness evidence import <feature-id> --ci-run <run-id> [--owner <o>] [--repo <r>]');
        process.exitCode = 1;
        return;
      }
      if (!owner || !repo) {
        const inferred = inferGithubRepoFromRemote(cwd);
        if (!inferred) {
          console.error('Could not infer owner/repo from git remote "origin" — pass --owner and --repo explicitly.');
          process.exitCode = 1;
          return;
        }
        owner = owner || inferred.owner;
        repo = repo || inferred.repo;
      }

      try {
        const evidence = runEvidenceImport(cwd, featureId, { owner, repo, runId });
        console.log(`Imported evidence for ${featureId} from CI run ${runId} (commit ${evidence.commit_sha}).`);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
      break;
    }
    case 'env': {
      if (rest[0] && rest[0] !== 'check') {
        console.error('Usage: sdlc-harness env [check]');
        process.exitCode = 1;
        return;
      }
      const config = loadConfig(path.join(cwd, 'harness.config.json'));
      const configuredKeys = Object.keys(config.commands).filter((key) => config.commands[key]);
      if (rest[0] !== 'check') {
        if (configuredKeys.length === 0) {
          console.log('No environment commands configured in harness.config.json\'s "commands" field.');
        } else {
          console.log('Configured environment commands:');
          for (const key of configuredKeys) console.log(`  ${key}: ${config.commands[key]}`);
        }
        break;
      }
      const { configured, ok, results } = runEnvCheck(cwd);
      if (!configured) {
        console.log('No environment commands configured — nothing to check.');
        break;
      }
      for (const r of results) {
        console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.key}: ${r.command} (exit ${r.exitCode})`);
      }
      if (!ok) process.exitCode = 1;
      break;
    }
    case 'feedback': {
      if (rest[0] !== 'log') {
        console.error('Usage: sdlc-harness feedback log --source <text> --severity <S1|S2|S3|S4> --observation <text> --disposition <Actioned|Deferred|Declined|Monitoring> [--detail <text>] [--date <YYYY-MM-DD>]');
        process.exitCode = 1;
        return;
      }
      const { flags } = parseValuedArgs(
        rest.slice(1), new Set(['--source', '--severity', '--observation', '--disposition', '--detail', '--date']),
      );
      try {
        const entry = recordFeedback(cwd, {
          date: flags['--date'],
          source: flags['--source'],
          severity: flags['--severity'],
          observation: flags['--observation'],
          disposition: flags['--disposition'],
          detail: flags['--detail'],
        });
        console.log(`Logged ${entry.severity} feedback (${entry.disposition}) from ${entry.source}.`);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
      break;
    }
    case 'session': {
      if (rest[0] !== 'close') {
        console.error('Usage: sdlc-harness session close');
        process.exitCode = 1;
        return;
      }
      const result = runSessionClose(cwd);
      if (!result.validate.ok) {
        console.error(`validate FAILED with ${result.validate.errors.length} error(s):`);
        for (const e of result.validate.errors) console.error(`  - ${e}`);
      } else {
        console.log('validate: OK');
      }
      if (result.env.configured) {
        for (const r of result.env.results) {
          console.log(`[${r.passed ? 'PASS' : 'FAIL'}] env.${r.key}: ${r.command} (exit ${r.exitCode})`);
        }
      } else {
        console.log('env: no environment commands configured');
      }
      console.log(`git: ${result.git.clean ? 'clean' : `${result.git.changedFiles.length} uncommitted change(s)`} at ${result.git.commitSha || '(no commit)'}`);
      console.log(`features: ${JSON.stringify(result.status.counts)}`);
      for (const action of result.status.nextActions) console.log(`next: ${action}`);
      if (!result.ok) process.exitCode = 1;
      break;
    }
    default:
      printUsage({ unknown: true });
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
