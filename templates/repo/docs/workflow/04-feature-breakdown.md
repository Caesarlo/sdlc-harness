# Stage 4: Feature Breakdown

## Inputs
- Approved user stories with acceptance criteria from stage 3.
- Approved ADRs from stage 2.

## What The Agent Does
- Decompose each story into one or more `feature_list.json` entries as **vertical
  slices**: each feature should cut through every layer it needs (UI, API, data) to
  produce one observable, independently verifiable outcome. Calibrate granularity to
  "completable in one session" — "user can add an item to their cart" is right-sized;
  "implement the cart" is too broad; "add a name field to the Cart model" is too narrow.
- Avoid horizontal (by-layer) splitting — e.g. one feature for "build the API" and a
  separate one for "build the UI" that consumes it. Neither half has an observable
  `behavior` on its own, so `verification` degrades into a technical check instead of a
  real end-to-end one, and the review gate in stage 6 has nothing meaningful to assess
  until both land together.
- Each feature's `behavior` field states an observable outcome, not an implementation
  detail, and should be derived directly from the When/Then of the acceptance criterion
  it cites — not a fresh paraphrase of it. Each `verification` entry must be an actually
  runnable command or an explicit manual check, and its `expected` value should mirror
  that criterion's Then clause.
- Put the exact `US-N.AC-N` reference on each corresponding verification entry's
  `source_refs` as well as on the feature. Feature-level refs prove scope; verification-
  level refs prove that a particular acceptance criterion has a concrete check.
- Each feature's `source_refs` must point at the ADR or requirements section that
  justifies it, and at the specific `US-N.AC-N` acceptance criterion it satisfies rather
  than the story as a whole — this is checked by the stage-gate validator.
- Use `npx @caesarlo/sdlc-harness new-feature` to append entries with the required shape.
- Set an optional numeric `priority` (lower runs first) when features within a milestone
  should be picked up in a specific order; `sdlc-harness claim --next` and `status`'s
  `readyFeatures` sort by it. Features without `priority` sort after prioritized ones, in
  the order they were added — so leaving it unset is fine for milestones with no ordering
  preference.

## Definition of Ready (before marking a feature `in_progress`)
- Every id in its `dependencies` array is `passing` — enforced by the
  `dependency-readiness` validator, which rejects an `in_progress` feature whose
  dependencies aren't all `passing`.
- `source_refs` already resolve (stage-gate validator).
- The verification command is concrete and runnable today, not a placeholder to fill in
  later.

## Required Output Artifacts
- Updated `feature_list.json` with concrete features (not just placeholders) for the
  milestone being planned.

## Exit Conditions
- `npx @caesarlo/sdlc-harness validate` passes: structural shape, dependency graph, dependency
  readiness, and stage-gate (source_refs resolve) all succeed.
- `npx @caesarlo/sdlc-harness traceability` has no uncovered requirement, orphan story,
  orphan feature, or unverified acceptance criterion after the `*-SCOPE-001` placeholder
  has been fully decomposed.
