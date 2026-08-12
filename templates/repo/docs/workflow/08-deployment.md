# Stage 8: Deployment

## Inputs
- A milestone whose features have all passed self-acceptance testing (stage 7).

## What The Agent Does
- Fill in `.github/workflows/deploy.yml` (scaffolded by `init`/`adopt`) for the actual
  deploy target.
- Work through a release checklist: versioning/changelog, rollback plan, required
  environment configuration, and who/what gets notified.
- Close the milestone's `*-RELEASE-001` gate feature (from stage 5) only once the
  checklist is complete and the deployment has actually run.

## Required Output Artifacts
- A completed deployment, or a documented reason it's deferred, recorded as evidence on
  the milestone's `*-RELEASE-001` feature.

## Exit Conditions
- The `*-RELEASE-001` feature for the milestone is `passing`, with evidence pointing at
  the actual deployment (or an explicit, approved decision to defer).
