import { spawnSync } from 'node:child_process';
import { loadConfig } from './config.js';
import path from 'node:path';

// Which configured commands `env check` / `session close` actually run, and
// in what order. `start` and `cleanup` are excluded: they're situational
// (start a long-running process, tear down state) rather than pass/fail
// checks, so running them here would either hang or destroy state instead
// of reporting anything useful.
const CHECK_ORDER = ['bootstrap', 'verify', 'e2e', 'health'];

// Runs the project's own environment commands (as distinct from a feature's
// declared `verification`) so a fresh Agent — or CI — can confirm the
// project actually installs, builds, and runs, not just that
// `feature_list.json` is structurally valid. Stops at the first failure,
// since a broken bootstrap makes every later command's result meaningless.
export function runEnvCheck(repoRoot, { exec = spawnSync } = {}) {
  const config = loadConfig(path.join(repoRoot, 'harness.config.json'));
  const configured = CHECK_ORDER.filter((key) => config.commands[key]);

  const results = [];
  let ok = true;
  for (const key of configured) {
    const command = config.commands[key];
    if (!ok) break;
    const result = exec(command, { cwd: repoRoot, shell: true, encoding: 'utf8' });
    const passed = result.status === 0;
    results.push({
      key, command, exitCode: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', passed,
    });
    if (!passed) ok = false;
  }

  return { ok, configured: configured.length > 0, results };
}
