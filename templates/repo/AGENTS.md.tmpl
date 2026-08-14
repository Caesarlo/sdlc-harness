# AGENTS.md

This repository uses **sdlc-harness**: every phase from raw requirements to deployment
and post-release feedback is tracked as machine-readable state in this repo, not as
chat history. Read this file before doing any implementation work.

## Startup Workflow

1. Confirm the repository root.
2. If `git config core.hooksPath` is not yet `.githooks`, run `git config core.hooksPath .githooks` once.
3. Run `npx @caesarlo/sdlc-harness validate`. It must exit 0 before any other step; if it fails,
   fixing `feature_list.json` (or the docs it depends on) is the narrow task for this
   session.
4. Run `npx @caesarlo/sdlc-harness status` to see the active feature, ready work, and suggested next action.
5. If `harness.config.json`'s `commands` has any entries set, run
   `npx @caesarlo/sdlc-harness env check` — `validate` only checks `feature_list.json`
   itself, this is what confirms the project actually installs, builds, and runs.
6. Read `progress.md`, especially the latest session entry.
7. Read the active feature's `source_refs` in `feature_list.json`.
8. Continue the active feature, or start the first ready feature reported by `status`
   with `sdlc-harness feature start <feature-id>`. Do not hand-edit a feature into
   `in_progress`.
9. If the selected feature's id matches `*-SCOPE-001`, its only allowed action is
   decomposition into session-sized features — never mark it `passing`.

## Routing Map

Stages 1, 2, 3, and 5 are conditionally required, not a mandatory sequence — each stage
document states at the top when it can be skipped. Stages 4, 6, and 7 are the
always-required core loop for any feature. Stages 8 and 9 follow `harness.config.json`'s
`deploymentMode`/`observabilityMode` (each defaults to always-required) — see those
stage docs for what changes when a project sets either to `"optional"` or `"none"`.

Pick your entry point by what you're actually doing:

- **New user-facing capability, unclear scope** — start at stage 1.
- **New capability, requirements already clear, but it crosses a service/module
  boundary or needs a new dependency** — start at stage 2.
- **Small enhancement or bug fix with no new requirement** — go straight to stage 4
  (skip 1-3, 5).
- **Production incident or regression** — go straight to stage 8/9 to restore service and
  capture the feedback, then open a stage-4 feature for the underlying fix.
- **Feature already exists in `feature_list.json` and is `not_started` with passing
  dependencies** — go straight to stage 6.

Stage docs:
- `docs/workflow/01-requirements.md` — capture and refine raw requirements
- `docs/workflow/02-architecture-design.md` — architecture decisions and ADRs
- `docs/workflow/03-user-stories.md` — user stories with acceptance criteria
- `docs/workflow/04-feature-breakdown.md` — turning stories into feature_list.json entries
- `docs/workflow/05-milestone-planning.md` — grouping features into ordered milestones
- `docs/workflow/06-agile-tdd.md` — TDD workflow (path chosen by `harness.config.json`'s
  `testStrategy`) and the review gate
- `docs/workflow/07-self-acceptance.md` — what counts as done
- `docs/workflow/08-deployment.md` — release checklist and deploy templates
- `docs/workflow/09-observability-feedback.md` — closing the loop back to requirements

## Feature Rules

- Only `rules.wip_limit_per_owner` feature(s) may be `in_progress` per `owner` at a time
  (default: 1). Features with no `owner` share one implicit bucket, so a single-agent
  repo that never sets `owner` behaves exactly as before.
- A feature may become `passing` only after its declared verification has run
  successfully, evidence is recorded, and an evidence entry with `kind: "review"` exists.
- Use `sdlc-harness verify <feature-id>` for executable verification, `sdlc-harness
  evidence manual ...` for declared manual checks, `sdlc-harness review record ...` for
  review evidence, and `sdlc-harness feature complete <feature-id>` for the final
  transition. Do not hand-edit status or evidence around these commands.
- `feature_list.json` is validated by `npx @caesarlo/sdlc-harness validate` — do not hand-edit
  around a failing check.
- If new required work is discovered, add a new feature; do not leave an untracked TODO.
- Human approval of a requirements, story, or architecture artifact is recorded by the
  Agent with `sdlc-harness evidence approval <artifact> --actor <id> --summary <text>`.
  Approval is bound to the artifact hash and becomes stale if the file changes.
- Use `sdlc-harness new-feature --input <json-file>` from Agent automation; the interactive
  form is a convenience for manual debugging, not the primary Agent interface.
- Run `sdlc-harness traceability` before presenting a feature plan or closing acceptance;
  surface every uncovered requirement and orphan story/feature to the user.

## End Of Session

1. Run `npx @caesarlo/sdlc-harness session close`. It runs `validate`, runs `env check`
   (if `commands` are configured), and reports git state plus `status`'s ready/blocked/
   next-action view — read its output before writing the checkpoint below, don't write
   the checkpoint from memory of what you think happened.
2. Append a checkpoint to `progress.md`: what changed, verification performed, evidence,
   next action.
3. Confirm your owner's `in_progress` count is within `rules.wip_limit_per_owner`.
