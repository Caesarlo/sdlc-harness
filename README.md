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

`init`/`adopt` scaffold a `.githooks/pre-commit` hook, but it stays inert until you point git
at it once: `git config core.hooksPath .githooks`.

## Commands

- `sdlc-harness init` — scaffold the full harness (docs, templates, hooks, CI) into an empty or new project.
- `sdlc-harness adopt` — insert only the missing pieces into an existing repository, leaving existing files untouched.
- `sdlc-harness validate` — check `feature_list.json` for structural correctness (required fields, valid status values, milestone references, at least one verification entry per feature), no dependency cycles or references to unknown features, only one feature `in_progress` at a time, evidence-backed pass gates (a `passing` feature needs a `review` entry and progress can't regress), no feature depending on a later milestone, ADR coverage of every topic required by `harness.config.json`, and that every non-placeholder feature's `source_refs` point to real files. Exits with a non-zero status on any failure, which is what the pre-commit hook and CI deploy workflow rely on to block bad states.
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
