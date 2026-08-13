import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGithubRepoConfig, inferGithubRepoFromRemote } from '../../src/lib/github-provider.js';

function mockGh(responses) {
  // responses: { [apiPath]: { status: 0, stdout } | { status: 1, stderr } }
  return (args) => {
    const apiPath = args[1];
    const response = responses[apiPath];
    if (!response) throw new Error(`unexpected gh api call: ${apiPath}`);
    return { status: response.status, stdout: response.stdout || '', stderr: response.stderr || '' };
  };
}

const FULLY_PROTECTED = {
  required_pull_request_reviews: { required_approving_review_count: 1 },
  required_status_checks: { contexts: ['ci'] },
  allow_force_pushes: { enabled: false },
};

test('checkGithubRepoConfig reports ok:true with an admin token that sees everything configured correctly', () => {
  const runGh = mockGh({
    'repos/acme/widgets/branches/main/protection': { status: 0, stdout: JSON.stringify(FULLY_PROTECTED) },
    'repos/acme/widgets/contents/.github/CODEOWNERS': { status: 0, stdout: JSON.stringify({ name: 'CODEOWNERS' }) },
    'repos/acme/widgets/rulesets': { status: 0, stdout: JSON.stringify([{ id: 1, name: 'main-protection' }]) },
  });

  const result = checkGithubRepoConfig('acme', 'widgets', { runGh });
  assert.equal(result.ok, true);
  assert.equal(result.degraded, false);
  assert.ok(result.findings.every((f) => f.status !== 'unknown'));
});

test('checkGithubRepoConfig reports actual misconfiguration as fail, not unknown', () => {
  const runGh = mockGh({
    'repos/acme/widgets/branches/main/protection': {
      status: 0,
      stdout: JSON.stringify({ required_pull_request_reviews: null, required_status_checks: null, allow_force_pushes: { enabled: true } }),
    },
    'repos/acme/widgets/contents/.github/CODEOWNERS': { status: 1, stderr: 'gh: Not Found (HTTP 404)' },
    'repos/acme/widgets/rulesets': { status: 0, stdout: JSON.stringify([]) },
  });

  const result = checkGithubRepoConfig('acme', 'widgets', { runGh });
  assert.equal(result.ok, false);
  assert.equal(result.degraded, false);

  const byCheck = Object.fromEntries(result.findings.map((f) => [f.check, f.status]));
  assert.equal(byCheck.branch_protection_requires_review, 'fail');
  assert.equal(byCheck.required_status_checks, 'fail');
  assert.equal(byCheck.force_push_blocked, 'fail');
  assert.equal(byCheck.codeowners, 'fail');
  assert.equal(byCheck.rulesets, 'fail');
});

test('checkGithubRepoConfig degrades admin-only checks to unknown (not fail) for a non-admin token, and stays ok:true if nothing actually fails', () => {
  const runGh = mockGh({
    // A non-admin token gets 404 from the branch protection and rulesets
    // endpoints even though protection may well be configured — GitHub
    // hides the detail rather than returning 403 for these specific ones.
    'repos/acme/widgets/branches/main/protection': { status: 1, stderr: 'gh: Branch not protected (HTTP 404)' },
    'repos/acme/widgets/contents/.github/CODEOWNERS': { status: 0, stdout: JSON.stringify({ name: 'CODEOWNERS' }) },
    'repos/acme/widgets/rulesets': { status: 1, stderr: 'gh: Resource not accessible by integration (HTTP 403)' },
  });

  const result = checkGithubRepoConfig('acme', 'widgets', { runGh });
  assert.equal(result.ok, true, 'degraded checks must not count as failures');
  assert.equal(result.degraded, true);

  const byCheck = Object.fromEntries(result.findings.map((f) => [f.check, f.status]));
  assert.equal(byCheck.branch_protection, 'unknown');
  assert.equal(byCheck.rulesets, 'unknown');
  assert.equal(byCheck.codeowners, 'pass');
});

test('checkGithubRepoConfig treats a genuine 404 on CODEOWNERS (contents API, no admin needed) as fail, not unknown', () => {
  const runGh = mockGh({
    'repos/acme/widgets/branches/main/protection': { status: 0, stdout: JSON.stringify(FULLY_PROTECTED) },
    'repos/acme/widgets/contents/.github/CODEOWNERS': { status: 1, stderr: 'gh: Not Found (HTTP 404)' },
    'repos/acme/widgets/rulesets': { status: 0, stdout: JSON.stringify([{ id: 1 }]) },
  });

  const result = checkGithubRepoConfig('acme', 'widgets', { runGh });
  assert.equal(result.ok, false);
  const codeowners = result.findings.find((f) => f.check === 'codeowners');
  assert.equal(codeowners.status, 'fail');
});

test('inferGithubRepoFromRemote parses an https github remote', () => {
  const runGit = () => ({ status: 0, stdout: 'https://github.com/acme/widgets.git\n', stderr: '' });
  assert.deepEqual(inferGithubRepoFromRemote('/repo', { runGit }), { owner: 'acme', repo: 'widgets' });
});

test('inferGithubRepoFromRemote parses an ssh github remote', () => {
  const runGit = () => ({ status: 0, stdout: 'git@github.com:acme/widgets.git\n', stderr: '' });
  assert.deepEqual(inferGithubRepoFromRemote('/repo', { runGit }), { owner: 'acme', repo: 'widgets' });
});

test('inferGithubRepoFromRemote returns null for a non-GitHub remote instead of throwing', () => {
  const runGit = () => ({ status: 0, stdout: 'https://gitlab.com/acme/widgets.git\n', stderr: '' });
  assert.equal(inferGithubRepoFromRemote('/repo', { runGit }), null);
});

test('inferGithubRepoFromRemote returns null when there is no such remote', () => {
  const runGit = () => ({ status: 1, stdout: '', stderr: 'fatal: No such remote' });
  assert.equal(inferGithubRepoFromRemote('/repo', { runGit }), null);
});
