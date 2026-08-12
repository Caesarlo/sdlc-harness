# Stage 4: Feature Breakdown

## Inputs
- Approved user stories with acceptance criteria from stage 3.
- Approved ADRs from stage 2.

## What The Agent Does
- Decompose each story into one or more `feature_list.json` entries. Calibrate
  granularity to "completable in one session" — "user can add an item to their cart" is
  right-sized; "implement the cart" is too broad; "add a name field to the Cart model" is
  too narrow.
- Each feature's `behavior` field states an observable outcome, not an implementation
  detail. Each `verification` entry must be an actually runnable command or an explicit
  manual check.
- Each feature's `source_refs` must point at the ADR or requirements section that
  justifies it — this is checked by the stage-gate validator.
- Use `npx sdlc-harness new-feature` to append entries with the required shape.

## Required Output Artifacts
- Updated `feature_list.json` with concrete features (not just placeholders) for the
  milestone being planned.

## Exit Conditions
- `npx sdlc-harness validate` passes: structural shape, dependency graph, and stage-gate
  (source_refs resolve) all succeed.
