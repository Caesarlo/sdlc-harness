# Stage 8: Deployment

## Inputs
- A milestone whose features have all passed self-acceptance testing (stage 7).

## What The Agent Does
- Fill in `.github/workflows/deploy.yml` (scaffolded by `init`/`adopt`) for the actual
  deploy target.
- Decompose the milestone's `*-RELEASE-001` placeholder feature (from stage 5) into
  concrete release-checklist features: versioning/changelog, rollback plan, required
  environment configuration, who/what gets notified, and the deployment run itself. The
  placeholder feature must never be marked `passing` — only decomposed, same as
  `*-SCOPE-001` in stage 4.
- Work each decomposed feature to `passing`, with evidence recorded per feature (a
  completed deployment, or a documented and approved reason a given item is deferred).

## Required Output Artifacts
- Updated `feature_list.json` with the concrete release-checklist features that replace
  the milestone's `*-RELEASE-001` placeholder.

## Exit Conditions
- The concrete release-checklist features decomposed from `*-RELEASE-001` are all
  `passing`, with evidence pointing at the actual deployment (or an explicit, approved
  decision to defer a given item).
- `npx sdlc-harness validate` reports no `pass-gate` errors for the milestone (no
  placeholder feature marked `passing`).
