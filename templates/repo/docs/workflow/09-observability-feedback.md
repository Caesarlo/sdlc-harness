# Stage 9: Observability & Feedback Loop

## Inputs
- A deployed milestone (stage 8 complete).

## What The Agent Does
- After deployment, watch the signals that matter for this project — error rates,
  performance, usage, direct user feedback.
- Log any signal worth acting on to `docs/product/feedback-log.md` with a date and a
  short description of what was observed.
- For any feedback item that implies new or changed scope, add it to
  `docs/product/requirements.md` (stage 1) or open a new feature directly — do not let it
  live only as a conversation note. This is what makes the harness a loop instead of a
  one-way pipeline: stage 9 output becomes stage 1 input for the next cycle.

## Required Output Artifacts
- `docs/product/feedback-log.md` entries.
- New or updated requirements/features for anything actionable.

## Exit Conditions
- Every feedback-log entry that implied new scope has a corresponding requirements
  update or feature — none are left dangling as unactioned notes.
