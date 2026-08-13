# Stage 2: Architecture & Technical Design

> [!TIP]
> Skip this stage for a feature that doesn't cross a service/module boundary, introduce a
> new dependency, or touch a decision already covered by an existing ADR. Go straight to
> stage 4 (or stage 6 for a trivial fix). Revisit this stage only when the change is
> load-bearing enough to justify an ADR — see the criterion below.

## Inputs
- The approved `docs/product/requirements.md`.

## What The Agent Does
- Propose 2-3 architecture approaches for anything non-obvious, with trade-offs, before
  committing to one.
- Record every load-bearing technical decision as an ADR in `docs/adr/`, using
  `docs/adr/template.md` as the shape (context, decision, considered options with
  pros/cons, consequences, and a `topic:` field used by the ADR-coverage validator).
  Add a row for it to `docs/adr/README.md`, the ADR index.
- Only open a new ADR for decisions that are load-bearing: they affect multiple
  features, are costly to reverse, or cross a service/module boundary. Local
  implementation details belong in code comments or the feature itself, not an ADR.
- Cover data model, service/module boundaries, and how each non-functional requirement
  from stage 1 will actually be met.
- Write a `ci-cd-strategy` ADR once the project has a real deploy target: branching
  model (trunk-based vs. longer-lived branches), what environments exist, what gates a
  merge to main (`.github/workflows/ci.yml`, scaffolded at `init`/`adopt`) versus what
  gates a production deploy (`.github/workflows/deploy.yml`, filled in at stage 8), and
  how secrets/config are managed per environment. This is a load-bearing decision like
  any other — treat it as one instead of letting stage 8 improvise it on the spot.
- Treat an `accepted` ADR as append-only. Never edit its Decision or Consequences after
  the fact — if circumstances change, write a new ADR, set its `supersedes` field, and
  update the old ADR's `status` to `superseded` with `superseded-by` pointing at the
  new one.
- A later stage (including stage 9's feedback loop) that invalidates an architectural
  decision should return here to write a superseding ADR, not silently reinterpret the
  old one.

## Required Output Artifacts
- One or more `docs/adr/NNNN-*.md` files, each indexed in `docs/adr/README.md`.
- `docs/architecture/overview.md` if the project has more than a handful of components,
  using `docs/architecture/overview-template.md` as the shape (components, data flow,
  key dependencies, links to the ADRs that explain each decision).

## Exit Conditions
- `npx sdlc-harness validate` reports no `adr-coverage` errors for the topics configured
  in `harness.config.json`.
- The user has reviewed and approved the architecture decisions.
