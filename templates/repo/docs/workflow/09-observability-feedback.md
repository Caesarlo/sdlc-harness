# Stage 9: Observability & Feedback Loop

## When This Stage Applies
Governed by `harness.config.json`'s `observabilityMode`:
- **`"runtime"`** — the project has real runtime signals (metrics, logs, traces, an
  error tracker) to watch; use them directly, not just the project's own judgment.
- **`"feedback-only"`** (default) — no runtime observability stack exists yet; watch
  whatever signals are actually available (issue reports, manual smoke checks, direct
  user feedback) and log them per this stage. This is a floor, not the target — moving
  to `"runtime"` as real signals come online is expected.
- **`"none"`** — for projects with no post-release audience to observe (a one-off script,
  a library with no telemetry). Skip this stage; still open a feature directly for any
  issue discovered some other way rather than losing it.

## Inputs
- A deployed milestone (stage 8 complete), or the equivalent completion point when
  `deploymentMode` is `"optional"`/`"none"`.

## What The Agent Does
- After deployment, watch the signals that matter for this project. Anchor "matter" to
  something concrete rather than judgment calls: check actual behavior against the
  `NFR-N` entries from `docs/product/requirements.md` (performance, availability,
  security, ...) plus error rates, usage, and direct user feedback that don't map to an
  existing NFR. Give the first period after deployment closer attention (the window
  stage 8's post-deploy health check already started watching), then settle into a
  normal cadence rather than checking once and stopping.
- Log every signal worth recording with `sdlc-harness feedback log --source <text>
  --severity <S1|S2|S3|S4> --observation <text> --disposition
  <Actioned|Deferred|Declined|Monitoring> [--detail <text>]` rather than hand-editing
  `docs/product/feedback-log.md` — the command enforces the shape
  `docs/product/feedback-log-template.md` describes (all fields present, a recognized
  severity, and a stated reason for `Deferred`/`Declined`) instead of relying on the
  entry being written correctly by hand; `sdlc-harness validate` also checks this for
  any entry that did get hand-edited. An S1/S2 entry (outage, data loss, core workflow
  blocked) is not just logged, it triggers immediate action rather than waiting for the
  next planning pass — open the feature (or reopen an in-flight one) right away.
- For any feedback item that implies new or changed scope, add it to
  `docs/product/requirements.md` (stage 1) or open a new feature directly — do not let it
  live only as a conversation note. This is what makes the harness a loop instead of a
  one-way pipeline: stage 9 output becomes stage 1 input for the next cycle.
- Every entry gets a disposition, including the ones that don't turn into new scope:
  `Deferred` or `Declined` entries must say why, not just sit unresolved. Silence isn't
  a valid outcome for an entry someone bothered to log.

## Required Output Artifacts
- `docs/product/feedback-log.md` entries, each with a disposition.
- New or updated requirements/features for anything actionable.

## Exit Conditions
- Every feedback-log entry has a disposition — `Actioned` entries link to the
  requirement/feature they became; `Deferred`/`Declined` entries state why; none are
  left with no decision recorded.
- Any S1/S2 entry has evidence of immediate action, not just a log entry.
