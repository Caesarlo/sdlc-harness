# Architecture Overview: <project name>

Required only when the project has more than a handful of components (see
`docs/workflow/02-architecture-design.md`). Keep this file in sync as ADRs are added or
superseded — it's the map; the ADRs are the reasoning behind each landmark on it.

## Components

One entry per deployable/runnable unit (service, CLI, job, library consumed by more than
one component). For each: what it does, what it owns, what it depends on.

- **<component name>** — <one-line responsibility>. Depends on: <other components,
  external services>. Owns: <data/resources it is the source of truth for>.

## Data Flow

How data or requests move between the components above for the project's 1-2 most
important flows. A short numbered list or an inline diagram is enough — this is not a
full sequence diagram for every flow, just the ones that would confuse a new agent
session without one.

## Key Dependencies

External services, data stores, and third-party APIs the system relies on, and which
component owns the integration.

| Dependency | Owning Component | Why |
| ---------- | ----------------- | --- |
| <name> | <component> | <what it's needed for> |

## Related ADRs

Link the ADRs that explain *why* the above looks the way it does, rather than
re-explaining the reasoning here.

- `docs/adr/NNNN-*.md` — <what it decided>
