# Stage 5: Milestone Planning

## Inputs
- The feature set produced in stage 4.

## What The Agent Does
- Group features into milestones ordered so that the highest-risk or most-blocking work
  lands in earlier milestones. Use concrete signals to judge risk/blocking rather than
  gut feel: how many other features depend on this one (fan-out), whether it exercises
  an ADR assumption that hasn't been proven in running code yet, and whether it touches
  an external integration outside the team's control. A feature with high fan-out that
  ends up in a late milestone is a red flag — surface it and reorder.
- The first milestone must contain a **walking skeleton**: at least one feature (or a
  small set) whose `verification` exercises a real end-to-end path through every
  architectural layer the system has (UI, API, data, and any external integration),
  even in a minimal/ugly form. Its purpose is to prove the architecture from stage 2
  actually holds together before the team invests in breadth. Don't let a milestone's
  first pass be all-backend or all-frontend — that's the same horizontal-slicing
  mistake stage 4 warns against, just at the milestone level.
- Calibrate milestone size the same way stage 4 calibrates feature size: a milestone
  should be a coherent slice of value deliverable within a predictable iteration
  horizon, not an open-ended bucket. "Users can complete checkout with a saved card" is
  right-sized; "checkout" alone is too broad; "add the payment-method dropdown" is too
  narrow for a milestone (that's a feature). If a milestone can't be described as a
  before/after capability change for the end user, it's not sliced correctly yet.
- A milestone that is too large or not yet understood well enough to break into concrete
  features gets a single placeholder feature instead, with an id ending in `-SCOPE-001`.
  Its only allowed action in a later session is decomposition into real features — it
  must never be marked `passing`.
- Write the milestone's `objective` as an observable capability change, not a technical
  task list — "what can a user or operator do after this milestone that they couldn't
  before" — so later stages (and stage 9 feedback) can tell whether it actually landed.
- Before a milestone is considered ready to close, add a release-readiness feature with
  an id ending in `-RELEASE-001` (see stage 8) that gates deployment on the milestone's
  checklist being complete.
- Milestone order isn't fixed once written: when stage 9 feedback or new information
  surfaces after later milestones are planned, re-sequence the not-yet-started ones
  rather than treating the original plan as final. Never reorder a milestone that
  already has `in_progress` or `passing` features in it.

## Required Output Artifacts
- Updated `milestones` array in `feature_list.json`, features assigned to the correct
  milestone.

## Exit Conditions
- `npx sdlc-harness validate` reports no `milestone-order` errors (no feature depends on
  a feature in a later milestone).
- The first milestone includes at least one feature whose `verification` is an
  end-to-end check (exercises more than one architectural layer), not only
  unit-level checks.
