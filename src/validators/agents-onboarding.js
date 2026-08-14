import fs from 'node:fs';
import path from 'node:path';

// adopt writes AGENTS.sdlc-harness.md as a sidecar instead of touching a
// pre-existing AGENTS.md (see src/commands/adopt.js). If nothing then links
// the two, a fresh Agent that only reads AGENTS.md never learns the harness
// exists — this check keeps that state from going unnoticed after adopt's
// one-time console message scrolls out of view.
export function validateAgentsOnboarding(repoRoot) {
  const sidecarPath = path.join(repoRoot, 'AGENTS.sdlc-harness.md');
  if (!fs.existsSync(sidecarPath)) return { ok: true, errors: [] };

  const agentsPath = path.join(repoRoot, 'AGENTS.md');
  const agentsContent = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
  if (agentsContent.includes('AGENTS.sdlc-harness.md')) return { ok: true, errors: [] };

  return {
    ok: false,
    errors: [
      'AGENTS.sdlc-harness.md exists but AGENTS.md does not reference it — add a line '
      + 'pointing to it (e.g. "See AGENTS.sdlc-harness.md for this repo\'s SDLC harness '
      + 'rules.") or a fresh Agent session will never discover the harness.',
    ],
  };
}
