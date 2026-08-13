# Stage 7: Self-Acceptance Testing

## Inputs
- A feature (or milestone) whose individual features are all `passing`.

## What The Agent Does
- Run the full verification suite, not just the one feature's own check.
- For each feature area being closed out, confirm there is at least one end-to-end or
  black-box check exercising it — a stack of unit tests alone is not self-acceptance.
- Investigate and fix any regression before proceeding; do not mark anything `passing`
  on top of a failing baseline.
- **Isolated acceptance pass**: dispatch a fresh subagent with only the milestone's
  `objective`, the relevant `US-N.AC-N` acceptance criteria, and each feature's
  `behavior` — not the implementation history or the controlling session's notes on how
  anything was built. The same context that just implemented the milestone is prone to
  self-preference bias (it knows where it "expects" things to work and checks there);
  a reviewer with no memory of the implementation is what catches what that context
  can't see. This subagent performs the exploratory pass below and the acceptance-
  criteria walk; it does not re-run the declared verification suite (the controlling
  session already did that).
- **Exploratory testing**: beyond the declared `verification` entries (which only prove
  the scenarios someone already thought to write down), the isolated subagent spends a
  round on unscripted exploration — boundary values, error paths, unexpected input,
  sequences of actions no single feature's verification covers. Record findings even
  when nothing turns up ("explored X, no issues found") so the absence of a check isn't
  mistaken for the absence of an attempt.
- **Acceptance-criteria walk**: for each `US-N.AC-N` the milestone claims to satisfy,
  confirm the criterion is observable in the running system, not just that the feature
  citing it has status `passing`. A feature can be marked `passing` on a test that
  drifted from its criterion during implementation; this step is what catches that,
  since the verification and the thing verifying it are otherwise written by the same
  hand.
- Decide, and record the decision, on whether this milestone needs a non-functional
  pass (performance, security, accessibility) beyond the per-feature security check
  already done in stage 6's review gate — e.g. several features together changing a
  hot path's aggregate latency, or a set of new UI features' combined accessibility.
  Explicitly noting "not needed, because ..." is an acceptable outcome; silently
  skipping it is not.
- Any exploratory finding or non-functional issue that isn't blocking release still
  goes to `docs/product/feedback-log.md` (stage 9) so it isn't lost once this stage
  closes — self-acceptance is where these are most likely to surface, but stage 9 is
  where they get triaged.

## Required Output Artifacts
- A recorded verification run (command + result) covering the milestone's full feature
  set, referenced from `progress.md`.
- The isolated subagent's exploratory-testing and acceptance-criteria-walk notes,
  including any findings logged to `docs/product/feedback-log.md`.

## Exit Conditions
- `npx sdlc-harness validate` passes.
- The full test/verification suite for the milestone passes, with the end-to-end check
  included.
- Every `US-N.AC-N` the milestone claims now has a recorded, isolated confirmation that
  it's observable in the running system.
