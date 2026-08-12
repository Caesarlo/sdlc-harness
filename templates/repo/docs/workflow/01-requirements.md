# Stage 1: Requirements

## Inputs
- The raw ask from the person requesting the project or feature.
- Any existing constraints (deadline, budget, compliance obligations, target users).

## What The Agent Does
- Ask clarifying questions one at a time: who is this for, what problem does it solve,
  what does success look like, what is explicitly out of scope.
- Capture non-functional requirements explicitly — performance, security, compliance,
  availability — do not let them stay implicit.
- Write each functional and non-functional requirement as a stable-ID EARS-style
  statement (e.g. `FR-1: WHEN <trigger>, the system SHALL <behavior>`), following
  `docs/product/requirements-template.md` as the shape. IDs are never renumbered or
  reused once written — later stages (ADRs, `feature_list.json` `source_refs`) point at
  them directly.
- Anything not yet confirmed with a stakeholder goes in Assumptions & Open Questions, not
  into a numbered requirement.
- Before asking for approval, read back the full FR/NFR list to the user in one pass so
  they can confirm or correct it as a whole, not just react to each question as it was
  asked.
- Do not propose a solution yet. This stage is about the problem, not the design.

## Required Output Artifacts
- `docs/product/requirements.md`, shaped like `docs/product/requirements-template.md`:
  problem statement, stakeholders, success metrics, ID'd functional requirements, ID'd
  non-functional requirements, explicit non-goals, assumptions & open questions.

## Exit Conditions
- The user has reviewed and approved `docs/product/requirements.md`.
- Every FR/NFR is written in EARS form with a stable ID — no requirement should read as
  pure aspiration, and none should be un-referenceable prose.
