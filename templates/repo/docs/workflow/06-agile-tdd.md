# Stage 6: Agile Development (TDD)

## Inputs
- One feature with status `not_started` and all dependencies `passing`.

## What The Agent Does
- Mark exactly one feature `in_progress` (the pass-gate validator rejects more than one).
- **Isolated TDD split**, for any feature above trivial complexity:
  1. Dispatch a test-writer subagent with only the feature's `behavior`, `verification`,
     and `source_refs` — not any implementation plan. It writes the failing test(s) and
     reports back the test file path only.
  2. In the controlling session (never delegated), run the new test and confirm it fails
     for the expected reason — missing behavior, not a typo or broken setup. This RED
     check is what proves the two agents were actually isolated.
  3. Dispatch a fresh implementer subagent with the test file path and the feature's
     `behavior` text, but not the test-writer's notes or reasoning. It writes the
     minimal code to pass, without editing the test's assertions.
  4. In the controlling session, run the test again and confirm GREEN, then run the
     feature's full declared verification.
- **Review gate**: dispatch a reviewer (fresh subagent or the controlling session acting
  in a reviewer role) to check the diff against the feature's behavior, plus a
  simplification and security pass. Record the outcome as an `evidence` entry with
  `kind: "review"` — this is required before the feature can move to `passing`.
- For trivial features (single-assertion, config-only), skip the subagent split; TDD
  in-session is fine, but the review gate still applies.

## Required Output Artifacts
- The implementation, its tests, and a review evidence entry recorded on the feature.

## Exit Conditions
- The feature's declared verification passes.
- `evidence` includes the verification result and a `kind: "review"` entry.
