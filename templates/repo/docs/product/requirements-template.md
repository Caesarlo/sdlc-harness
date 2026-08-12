# Requirements: <project or feature name>

## Problem Statement

What problem exists today, for whom, and why it's worth solving now.

## Stakeholders

Who asked for this, who is affected, who signs off.

## Success Metrics

How we'll know this worked. Numbers or observable outcomes, not adjectives.

## Functional Requirements

One entry per requirement, each with a stable ID (`FR-1`, `FR-2`, ...) that never gets
reused or renumbered once referenced elsewhere (e.g. from `feature_list.json`
`source_refs` or an ADR's Context section). Write each in EARS form so it is testable by
construction:

- **FR-1**: WHEN <trigger/condition>, the system SHALL <required behavior>.
- **FR-2**: WHILE <state>, the system SHALL <required behavior>.
- **FR-3**: IF <trigger>, THEN the system SHALL <required behavior>.

(EARS patterns: ubiquitous — "The system SHALL <behavior>"; event-driven — "WHEN
<trigger>, the system SHALL <behavior>"; state-driven — "WHILE <state>, the system SHALL
<behavior>"; unwanted behavior — "IF <trigger>, THEN the system SHALL <behavior>";
optional — "WHERE <feature is present>, the system SHALL <behavior>".)

## Non-Functional Requirements

Same ID + EARS discipline as above, numbered independently (`NFR-1`, `NFR-2`, ...).
Cover performance, security, compliance, availability, and anything else that would
otherwise stay implicit.

## Explicit Non-Goals

What this project will deliberately not do, so scope creep has something to point at.

## Assumptions & Open Questions

Anything treated as true but not yet confirmed with a stakeholder, and anything still
unresolved. Nothing here counts as an approved requirement until it moves up into FR/NFR
or is explicitly resolved.
