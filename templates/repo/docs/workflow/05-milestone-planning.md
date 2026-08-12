# Stage 5: Milestone Planning

## Inputs
- The feature set produced in stage 4.

## What The Agent Does
- Group features into milestones ordered so that the highest-risk or most-blocking work
  lands in earlier milestones.
- A milestone that is too large or not yet understood well enough to break into concrete
  features gets a single placeholder feature instead, with an id ending in `-SCOPE-001`.
  Its only allowed action in a later session is decomposition into real features — it
  must never be marked `passing`.
- Before a milestone is considered ready to close, add a release-readiness feature with
  an id ending in `-RELEASE-001` (see stage 8) that gates deployment on the milestone's
  checklist being complete.

## Required Output Artifacts
- Updated `milestones` array in `feature_list.json`, features assigned to the correct
  milestone.

## Exit Conditions
- `npx sdlc-harness validate` reports no `milestone-order` errors (no feature depends on
  a feature in a later milestone).
