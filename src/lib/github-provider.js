import { spawnSync } from 'node:child_process';

function defaultRunGh(args) {
  return spawnSync('gh', args, { encoding: 'utf8' });
}

function extractHttpStatus(text) {
  const match = /HTTP (\d{3})/.exec(text || '');
  return match ? Number(match[1]) : null;
}

// Calls `gh api <path>` and classifies the result. Some endpoints (branch
// protection, rulesets) require admin access and GitHub returns 403/404 for
// non-admin tokens rather than distinguishing "forbidden" from "doesn't
// exist" — degradeOnStatuses lists which HTTP statuses should be treated as
// "can't verify with this token" (a warning) rather than "check failed"
// (an actual finding) for that specific endpoint.
function ghApi(runGh, path, { degradeOnStatuses = [] } = {}) {
  const result = runGh(['api', path]);
  if (result.status === 0) {
    try {
      return { ok: true, data: JSON.parse(result.stdout) };
    } catch {
      return { ok: true, data: result.stdout };
    }
  }

  const reason = (result.stderr || result.stdout || '').trim();
  const httpStatus = extractHttpStatus(reason);
  const degraded = httpStatus !== null && degradeOnStatuses.includes(httpStatus);
  return { ok: false, degraded, httpStatus, reason };
}

// Checks the governance settings a team-mode repo is expected to have:
// branch protection requiring PR review, required status checks, a
// CODEOWNERS file, and at least one ruleset. Every check that needs
// admin-level access degrades to status 'unknown' instead of 'fail' when
// the token can't see it — the check as a whole is still usable with a
// normal developer token, it just can't fully verify everything.
export function checkGithubRepoConfig(owner, repo, { runGh = defaultRunGh, branch = 'main' } = {}) {
  const findings = [];

  const protection = ghApi(runGh, `repos/${owner}/${repo}/branches/${branch}/protection`, { degradeOnStatuses: [403, 404] });
  if (protection.ok) {
    const requiresReview = Boolean(protection.data.required_pull_request_reviews);
    findings.push({
      check: 'branch_protection_requires_review',
      status: requiresReview ? 'pass' : 'fail',
      detail: requiresReview ? 'pull request reviews are required' : 'branch protection does not require PR review',
    });
    const requiredChecks = protection.data.required_status_checks;
    const hasContexts = Boolean(requiredChecks && Array.isArray(requiredChecks.contexts) && requiredChecks.contexts.length > 0);
    findings.push({
      check: 'required_status_checks',
      status: hasContexts ? 'pass' : 'fail',
      detail: hasContexts ? `required contexts: ${requiredChecks.contexts.join(', ')}` : 'no required status checks configured',
    });
    const forcePushAllowed = Boolean(protection.data.allow_force_pushes && protection.data.allow_force_pushes.enabled);
    findings.push({
      check: 'force_push_blocked',
      status: forcePushAllowed ? 'fail' : 'pass',
      detail: forcePushAllowed ? 'force pushes are allowed on this branch' : 'force pushes are blocked',
    });
  } else if (protection.degraded) {
    findings.push({ check: 'branch_protection', status: 'unknown', detail: `cannot verify with this token (HTTP ${protection.httpStatus}) — branch protection detail requires admin access` });
  } else {
    findings.push({ check: 'branch_protection', status: 'fail', detail: protection.reason });
  }

  const codeowners = ghApi(runGh, `repos/${owner}/${repo}/contents/.github/CODEOWNERS`, { degradeOnStatuses: [403] });
  if (codeowners.ok) {
    findings.push({ check: 'codeowners', status: 'pass', detail: 'CODEOWNERS is present' });
  } else if (codeowners.degraded) {
    findings.push({ check: 'codeowners', status: 'unknown', detail: `cannot verify with this token (HTTP ${codeowners.httpStatus})` });
  } else {
    findings.push({ check: 'codeowners', status: 'fail', detail: 'no .github/CODEOWNERS file found' });
  }

  const rulesets = ghApi(runGh, `repos/${owner}/${repo}/rulesets`, { degradeOnStatuses: [403, 404] });
  if (rulesets.ok) {
    const hasRulesets = Array.isArray(rulesets.data) && rulesets.data.length > 0;
    findings.push({ check: 'rulesets', status: hasRulesets ? 'pass' : 'fail', detail: hasRulesets ? `${rulesets.data.length} ruleset(s) configured` : 'no rulesets configured' });
  } else if (rulesets.degraded) {
    findings.push({ check: 'rulesets', status: 'unknown', detail: `cannot verify with this token (HTTP ${rulesets.httpStatus}) — rulesets require admin access` });
  } else {
    findings.push({ check: 'rulesets', status: 'fail', detail: rulesets.reason });
  }

  return {
    ok: findings.every((f) => f.status !== 'fail'),
    degraded: findings.some((f) => f.status === 'unknown'),
    findings,
  };
}

// Best-effort inference of {owner, repo} from `git remote get-url <remote>`
// for a github.com HTTPS or SSH remote. Returns null if it can't be parsed
// (no such remote, non-GitHub host, etc.) rather than throwing.
export function inferGithubRepoFromRemote(repoRoot, { runGit = (args) => spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' }), remote = 'origin' } = {}) {
  const result = runGit(['remote', 'get-url', remote]);
  if (result.status !== 0) return null;
  const url = result.stdout.trim();

  const httpsMatch = /github\.com[/:]([^/]+)\/([^/.]+?)(\.git)?$/.exec(url);
  if (!httpsMatch) return null;
  return { owner: httpsMatch[1], repo: httpsMatch[2] };
}
