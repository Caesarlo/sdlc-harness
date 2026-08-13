# Stage 6: Agile Development (TDD)

## Inputs
- One feature with status `not_started` and all dependencies `passing`.

## What The Agent Does
- Mark exactly one feature `in_progress` per owner (the pass-gate validator rejects more
  than one `in_progress` feature for the same `owner`).
- Read `harness.config.json`'s `testStrategy` and follow the matching path below. If the
  field is absent, `isolated-tdd` is the default.

### `testStrategy: "isolated-tdd"` (default)
- **Isolated TDD split**, for any feature above trivial complexity:
  1. Dispatch a test-writer subagent with only the feature's `behavior`, `verification`,
     and `source_refs` — not any implementation plan. It writes the failing test(s) and
     reports back the test file path only. Assertions must anchor to the observable
     result described in `behavior` (return values, visible state, output) — never to
     implementation details such as call counts on private helpers, internal call
     order, or private state, since those couple the test to one implementation and
     make legitimate refactoring look like a regression.
  2. In the controlling session (never delegated), run the new test and confirm it fails
     for the expected reason — missing behavior, not a typo or broken setup. This RED
     check is what proves the two agents were actually isolated. Snapshot the test
     file's contents (or hash) before moving on.
  3. Dispatch a fresh implementer subagent with the test file path and the feature's
     `behavior` text, but not the test-writer's notes or reasoning. It writes the
     minimal code to pass, without editing the test's assertions. If `verification`
     lists multiple checks, drive them one at a time — get the first RED to GREEN
     before writing code for the next — rather than writing all the tests up front and
     implementing everything in one pass.
  4. In the controlling session, diff the test file against the step-2 snapshot; if it
     changed, reject the implementer's change and re-dispatch rather than accepting an
     implementation that edited its own tests to pass. Then run the test again and
     confirm GREEN, then run the feature's full declared verification.
- For trivial features, skip the subagent split; TDD in-session is fine, but the
  refactor step and review gate below still apply. "Trivial" is limited to features with
  no branching logic and no external dependency (e.g. a single config value or a pure
  pass-through) — anything with a conditional, a loop, or an I/O boundary is not trivial
  and gets the full isolated split.

### `testStrategy: "in-session-tdd"`
- Write the failing test and the implementation in the same session, in that order
  (test first, confirm RED, then implement to GREEN). No subagent split is required.
  Use this when the added isolation cost of separate test-writer/implementer dispatches
  isn't worth it for the project's size or risk profile.

### `testStrategy: "team-default"`
- Follow whatever test methodology the project's own contributing docs or CI already
  enforce (property-based tests, existing regression suite, snapshot tests, etc.).
  `sdlc-harness` does not prescribe the mechanism here — only the exit conditions below
  still apply.

## Required Everywhere (regardless of `testStrategy`)
- **Refactor step (mandatory, not optional)**: once GREEN, look for simplification —
  duplication, unclear naming, structure that will resist the next feature — and
  actually apply it, re-running the tests after each change to confirm they stay GREEN.
  This is a real code-change step, not a comment left for later; skipping it because
  "the code looks fine" is a valid outcome, skipping it because there was no time is
  not.
- **Review gate**: after refactoring, dispatch a reviewer (fresh subagent or the
  controlling session acting in a reviewer role) to check the diff against the
  feature's behavior, plus a security pass. Record the outcome as an `evidence` entry
  with `kind: "review"` — this is required before the feature can move to `passing`,
  regardless of which `testStrategy` was used to get there.

## Required Output Artifacts
- The implementation, its tests, and a review evidence entry recorded on the feature.

## Exit Conditions
- The feature's declared verification passes.
- `evidence` includes the verification result and a `kind: "review"` entry.
