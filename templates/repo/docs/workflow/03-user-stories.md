# Stage 3: User Story Design

## Inputs
- Approved requirements and architecture from stages 1-2.

## What The Agent Does
- Write user stories in the form "As a <role>, I want <capability>, so that <outcome>.",
  using `docs/product/user-stories-template.md` as the shape: a stable `US-N` ID per
  story, and stable `US-N.AC-N` IDs for its acceptance criteria.
- Write acceptance criteria in Given/When/Then form. That structure maps directly onto a
  feature's `verification` entry in stage 4 — free prose does not.
- Keep each story to 1-3 acceptance criteria. A story needing 4 or more is a signal to
  split it before moving on — use the SPIDR techniques (Spike, Path, Interface, Data,
  Rules) documented in the template.
- Group related stories; every split-off story must still be independently valuable and
  testable on its own (INVEST), not a fragment that only works alongside its sibling.

## Required Output Artifacts
- `docs/product/user-stories.md`, one entry per story, each with a stable ID and a
  Given/When/Then acceptance-criteria list with their own stable IDs.

## Exit Conditions
- Every acceptance criterion is concrete enough to become a feature's `verification`
  entry in stage 4 without rewriting.
- No story has 4+ acceptance criteria without a documented reason it wasn't split.
- The user has reviewed and approved the story set.
