# ADR NNNN: <short decision title>

topic: <matches an entry in harness.config.json's requiredAdrTopics, if applicable>
date: <YYYY-MM-DD>
status: proposed | accepted | superseded
supersedes: <ADR NNNN, if any>
superseded-by: <ADR NNNN, if any — filled in only once a later ADR replaces this one>

## Context

What problem or requirement (link back to `docs/product/requirements.md`) forced this
decision? What constraints applied?

## Decision

What was decided, stated as a single clear sentence, followed by the detail.

## Considered Options

List every option seriously evaluated, including the one chosen. For each:

### Option A: <name>
- Pros: ...
- Cons: ...

### Option B: <name>
- Pros: ...
- Cons: ...

## Consequences

What does this make easier? What does it make harder? What follow-up work does it
create?

---
An accepted ADR is append-only: never edit its Decision or Consequences after the fact.
If circumstances change, write a new ADR, set its `supersedes` field, and update this
one's `status` to `superseded` and `superseded-by`.
