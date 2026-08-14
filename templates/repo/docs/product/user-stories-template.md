# User Stories: <project or feature name>

One entry per story, each with a stable ID (`US-1`, `US-2`, ...) that never gets reused
or renumbered once referenced elsewhere (e.g. from `feature_list.json`'s `source_refs`).
Acceptance criteria get their own stable IDs nested under the story (`US-1.AC-1`,
`US-1.AC-2`, ...) so a feature can cite the exact criterion it satisfies instead of the
whole story.

## US-1: <short title>

Source Requirements: `FR-1` (and any relevant `NFR-N` IDs).

As a <role>, I want <capability>, so that <outcome>.

Acceptance Criteria (aim for 1-3; 4 or more is a signal the story should be split — see
below):

- **US-1.AC-1**: Given <context/precondition>, When <action>, Then <observable outcome>.
- **US-1.AC-2**: Given <context/precondition>, When <action>, Then <observable outcome>.

## Splitting Large Stories

A story needing 4+ acceptance criteria to be testable, or bundling more than one
independently shippable slice, should be split before stage 4 rather than carried
forward oversized. Use SPIDR to find the cut:

- **Spike** — blocked on an unknown; split off a time-boxed investigation from the rest.
- **Path** — split by alternate paths through a workflow (happy path vs. edge paths).
- **Interface** — split by UI, platform, or channel (e.g. web form vs. API).
- **Data** — split by the type, source, or complexity of the data handled.
- **Rules** — split by business rule, validation, or calculation variant.

Each resulting story keeps its own ID, its own acceptance criteria, and must still be
independently valuable and testable on its own (INVEST).
