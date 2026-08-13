# Feedback Log

One entry per signal worth recording, newest first. Append, don't rewrite history — if a
decision changes later, add a new entry rather than editing an old one.

## Entry shape

- **Date**: when the signal was observed.
- **Source**: where it came from — an `NFR-N` it relates to, an error/metric dashboard,
  direct user report, exploratory testing from stage 7, etc.
- **Severity**: `S1` (data loss/outage), `S2` (core workflow blocked), `S3` (workaround
  exists), `S4` (cosmetic/no workflow impact). S1/S2 get immediate action, not just a log
  entry.
- **Observation**: what was actually seen — numbers or a concrete description, not a
  vague impression.
- **Disposition**: one of
  - `Actioned` — link to the requirement (`FR-N`/`NFR-N`) or feature id it became.
  - `Deferred` — why it's not being acted on now, and what would change that.
  - `Declined` — why it's not being acted on at all.
  - `Monitoring` — not actionable yet on its own, being watched for a pattern.

No entry may be left without a Disposition. "Noted but no decision yet" is not a valid
end state for this log.

## Example

- **Date**: 2026-01-15
- **Source**: NFR-3 (p95 API latency < 300ms)
- **Severity**: S2
- **Observation**: p95 latency on `/checkout` hit 480ms for 20 minutes after the 2026-01-15
  deploy, before falling back under threshold.
- **Disposition**: Actioned — opened `NFR-3-PERF-002` to add caching on the checkout
  price lookup.
