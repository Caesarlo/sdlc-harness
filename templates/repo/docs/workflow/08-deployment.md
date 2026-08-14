# Stage 8: Deployment

## When This Stage Applies
Governed by `harness.config.json`'s `deploymentMode`:
- **`"required"`** (default) — this stage applies to every milestone; skipping it is not
  an option.
- **`"optional"`** — apply it when the milestone actually ships something deployable;
  skip it (and say so in `progress.md`) for milestones that don't, e.g. internal
  refactors with no release-facing change.
- **`"none"`** — for projects with no deployment target at all (libraries, CLIs consumed
  via package manager, internal scripts). Skip this stage entirely; the milestone's
  `*-RELEASE-001` placeholder, if any, should be removed or replaced with a publish
  checklist appropriate to the project instead.

## Inputs
- A milestone whose features have all passed self-acceptance testing (stage 7).

## What The Agent Does
- This stage owns CD (trunk deployment) only. CI (the `.github/workflows/ci.yml`
  pull-request validation pipeline) was already scaffolded at `init`/`adopt` and has
  been gating merges to main since the project's first commit — nothing to set up here.
  If the project has a `ci-cd-strategy` ADR from stage 2, follow it; if this is the
  first milestone reaching deployment and no such ADR exists yet, go write one before
  improvising the pipeline shape here.
- Fill in `.github/workflows/deploy.yml` (scaffolded by `init`/`adopt`) for the actual
  deploy target, including a post-deploy health check step (smoke test or
  health-endpoint check) that gates the deployment from being considered done, and a
  documented rollback path — don't leave either as the scaffolded placeholder.
- Decompose the milestone's `*-RELEASE-001` placeholder feature (from stage 5) into
  concrete release-checklist features: versioning/changelog, rollback plan, required
  environment configuration, who/what gets notified, and the deployment run itself. If
  the milestone changed the database schema, add a dedicated migration-safety feature —
  see below. The placeholder feature must never be marked `passing` — only decomposed,
  same as `*-SCOPE-001` in stage 4.
- **Deploy and release are separate decisions.** Code reaching production doesn't have
  to mean users see new behavior immediately — prefer shipping risk-bearing changes
  behind a flag (or otherwise dark) and enabling them as a separate step, so "roll back"
  means flipping the flag off rather than re-deploying. Size the rollback plan to the
  change's risk: a low-risk change can document "re-deploy the previous version"; a
  change to a core path or to how data is written should default to a flag-based
  instant rollback unless there's a specific reason that's not practical here.
- **Migration safety**, for any milestone that changed the database schema: migrations
  must be backward compatible with the currently-running application code — i.e. safe
  to apply while the old version is still serving traffic — using an expand/contract
  approach (add new columns/tables, backfill, dual-write if needed, cut the application
  over, only then remove the old structure in a later migration). Never require the
  schema migration and the application deploy to land atomically; if a proposed
  migration can't be made backward compatible, treat that as a blocker to resolve before
  this feature can pass, not a detail to note and move past.
- Work each decomposed feature to `passing`. The deployment-run feature's evidence must
  include both the deployment record and the result of the post-deploy health check —
  "the deploy command ran" is not evidence the deployment succeeded. Evidence for other
  items is either a completed action, or a documented and approved reason a given item
  is deferred.

## Required Output Artifacts
- Updated `feature_list.json` with the concrete release-checklist features that replace
  the milestone's `*-RELEASE-001` placeholder.

## Exit Conditions
- The concrete release-checklist features decomposed from `*-RELEASE-001` are all
  `passing`, with evidence pointing at the actual deployment and its post-deploy health
  check (or an explicit, approved decision to defer a given item).
- `npx @caesarlo/sdlc-harness validate` reports no `pass-gate` errors for the milestone (no
  placeholder feature marked `passing`).
