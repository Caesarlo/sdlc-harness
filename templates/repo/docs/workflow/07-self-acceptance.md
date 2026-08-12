# Stage 7: Self-Acceptance Testing

## Inputs
- A feature (or milestone) whose individual features are all `passing`.

## What The Agent Does
- Run the full verification suite, not just the one feature's own check.
- For each feature area being closed out, confirm there is at least one end-to-end or
  black-box check exercising it — a stack of unit tests alone is not self-acceptance.
- Investigate and fix any regression before proceeding; do not mark anything `passing`
  on top of a failing baseline.

## Required Output Artifacts
- A recorded verification run (command + result) covering the milestone's full feature
  set, referenced from `progress.md`.

## Exit Conditions
- `npx sdlc-harness validate` passes.
- The full test/verification suite for the milestone passes, with the end-to-end check
  included.
