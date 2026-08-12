# sdlc-harness

Portable CLI and workflow docs for a requirements-to-deployment coding-agent harness.
Any coding agent that can read a repository's `AGENTS.md` can drive the whole workflow;
Claude Code additionally gets thin skill wrappers for discoverability.

## Quickstart

    npx sdlc-harness init        # empty/new directory: scaffold everything
    npx sdlc-harness adopt       # existing repository: insert only what's missing
    npx sdlc-harness validate    # run all governance checks
    npx sdlc-harness status      # summarize milestone/feature state
    npx sdlc-harness new-feature
    npx sdlc-harness new-milestone

## Commands

- `sdlc-harness init` — scaffold the full harness (docs, templates, hooks, CI) into an empty or new project.
- `sdlc-harness adopt` — insert only the missing pieces into an existing repository, leaving existing files untouched.
- `sdlc-harness validate` — run all governance checks (requirements, ADRs, user stories, feature breakdown, milestone plan, deployment/observability docs) and report pass/fail.
- `sdlc-harness status` — summarize current milestone and feature state at a glance.
- `sdlc-harness new-feature` — create a new feature breakdown entry from the template.
- `sdlc-harness new-milestone` — create a new milestone plan entry from the template.

## The 9 Stages

1. Requirements
2. Architecture & Technical Design (ADRs)
3. User Story Design
4. Feature Breakdown
5. Milestone Planning
6. Agile Development (TDD)
7. Self-Acceptance Testing
8. Deployment
9. Observability & Feedback Loop (closes back to stage 1)

Each stage's full guide lives in `docs/workflow/0N-*.md` once you run `init`/`adopt`.

## Design

See `docs/superpowers/specs/2026-08-11-sdlc-harness-design.md` for the full design spec.
