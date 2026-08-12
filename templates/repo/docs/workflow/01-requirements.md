# Stage 1: Requirements

## Inputs
- The raw ask from the person requesting the project or feature.
- Any existing constraints (deadline, budget, compliance obligations, target users).

## What The Agent Does
- Ask clarifying questions one at a time: who is this for, what problem does it solve,
  what does success look like, what is explicitly out of scope.
- Capture non-functional requirements explicitly — performance, security, compliance,
  availability — do not let them stay implicit.
- Do not propose a solution yet. This stage is about the problem, not the design.

## Required Output Artifacts
- `docs/product/requirements.md` containing: problem statement, stakeholders, success
  metrics, functional requirements, non-functional requirements, explicit non-goals.

## Exit Conditions
- The user has reviewed and approved `docs/product/requirements.md`.
- Every requirement is concrete enough that a later stage could write a testable
  acceptance criterion from it — no requirement should read as pure aspiration.
