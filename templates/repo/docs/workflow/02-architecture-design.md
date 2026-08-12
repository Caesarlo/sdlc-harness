# Stage 2: Architecture & Technical Design

## Inputs
- The approved `docs/product/requirements.md`.

## What The Agent Does
- Propose 2-3 architecture approaches for anything non-obvious, with trade-offs, before
  committing to one.
- Record every load-bearing technical decision as an ADR in `docs/adr/`, using
  `docs/adr/template.md` as the shape (context, decision, consequences, and a `topic:`
  field used by the ADR-coverage validator).
- Cover data model, service/module boundaries, and how each non-functional requirement
  from stage 1 will actually be met.

## Required Output Artifacts
- One or more `docs/adr/NNNN-*.md` files.
- An architecture overview doc if the project has more than a handful of components.

## Exit Conditions
- `npx sdlc-harness validate` reports no `adr-coverage` errors for the topics configured
  in `harness.config.json`.
- The user has reviewed and approved the architecture decisions.
