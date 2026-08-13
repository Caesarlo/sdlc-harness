<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/sdlc-harness-banner-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/sdlc-harness-banner-light.png">
    <img src="docs/assets/sdlc-harness-banner-light.png" alt="A connected software-development lifecycle with branching paths and verification checkpoints" width="100%">
  </picture>
</p>

<h1 align="center">SDLC-Harness</h1>

<p align="center">
  <a href="package.json"><img src="https://img.shields.io/badge/version-0.1.0-f59e0b?style=flat-square&labelColor=262626" alt="Version 0.1.0"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?style=flat-square&logo=nodedotjs&logoColor=white&labelColor=262626" alt="Node.js 22 or newer"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square&labelColor=262626" alt="MIT License"></a>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/README-English-2563eb?style=flat-square&labelColor=262626" alt="Read in English"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-6b7280?style=flat-square&labelColor=262626" alt="阅读简体中文版本"></a>
</p>

<p align="center">
  <strong>Give coding agents a persistent, verifiable software-development workflow.</strong>
</p>

<p align="center">
  Repository-native governance for the <strong>Software Development Life Cycle (SDLC)</strong>,
  built for coding agents.
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a>  · 
  <a href="#the-full-sdlc-workflow">Workflow</a>  · 
  <a href="#commands">Commands</a>
</p>

<p align="center"><code>npx sdlc-harness adopt</code></p>

The **Software Development Life Cycle (SDLC)** is the complete process through which software
moves from requirements and architecture to implementation, verification, deployment, and
post-release feedback. `sdlc-harness` turns that process into a repository-native workflow for
coding agents.

Requirements, architecture decisions, feature status, dependencies, verification records, and
progress checkpoints live beside the code instead of disappearing into chat history.

It is agent-independent: any coding agent that can read `AGENTS.md` and repository files can
follow the workflow. Claude Code also receives thin skill wrappers for easier discovery.

## The problem it solves

Coding agents can write code quickly, but work often drifts across sessions:

- the next agent does not know why a change was started;
- half-finished work is reported as complete;
- features lose their links to requirements and architecture decisions;
- several tasks become "in progress" at once;
- progress exists only in a conversation that may no longer be available.

`sdlc-harness` makes the repository the source of truth and gives Git hooks or CI a command
that can reject inconsistent state.

## Quickstart

Requires **Node.js 22 or later**.

> [!TIP]
> `adopt` creates only missing files. Existing files stay untouched and are listed for manual
> review.

### Add it to an existing repository

```bash
cd your-project
npx sdlc-harness adopt
git config core.hooksPath .githooks
npx sdlc-harness validate
npx sdlc-harness status
```

### Start in an empty repository

```bash
mkdir your-project && cd your-project
npx sdlc-harness init
git config core.hooksPath .githooks
npx sdlc-harness validate
```

Then ask your coding agent to read `AGENTS.md` and help define or decompose the first real
milestone.

## What changes in the agent workflow

```mermaid
flowchart LR
    Goal["Developer provides a goal"] --> Guide["Agent reads AGENTS.md"]
    Guide --> State["Loads active feature, dependencies, and source_refs"]
    State --> Work["Implements and verifies one feature"]
    Work --> Evidence["Records verification and review evidence"]
    Evidence --> Validate["sdlc-harness validate"]
    Validate -->|pass| Ship["Commit / CI / deployment"]
    Validate -->|fail| Work
    Ship --> Checkpoint["Update progress.md"]
    Checkpoint --> Guide
```

The harness provides three layers:

- **Persistent context** — `AGENTS.md`, `feature_list.json`, ADRs, workflow documents, and
  `progress.md` survive agents and sessions.
- **Explicit completion rules** — each owner may have at most `wip_limit_per_owner`
  active features (default 1), dependencies must be valid, and a passing feature must
  have recorded evidence including a review entry.
- **Executable governance** — `sdlc-harness validate` exits non-zero when repository state
  violates the contract, so the same rules can run locally and in CI.

## See it in action

`status` gives an agent or developer the same machine-readable view of current work:

```bash
npx sdlc-harness status
```

```json
{
  "project": "checkout-service",
  "counts": {
    "not_started": 4,
    "in_progress": 1,
    "blocked": 0,
    "passing": 6
  },
  "activeFeatures": [
    {
      "id": "M1-CHECKOUT-003",
      "title": "Handle payment timeout",
      "behavior": "A timed-out payment returns a recoverable error.",
      "owner": null
    }
  ],
  "milestoneCount": 2
}
```

An invalid completion claim is rejected with a concrete reason:

```text
FAILED with 1 error(s):
  - [pass-gate] Feature M1-CHECKOUT-003 is passing but has no evidence entry with kind "review"
```

## What `validate` enforces

The validator checks:

- required fields, valid status values, unique feature IDs, and valid milestone references;
- declared verification for every feature;
- known dependencies with no dependency cycles;
- no dependency on a feature in a later milestone;
- at most `rules.wip_limit_per_owner` `in_progress` features per owner (default 1);
- evidence and a `review` entry for every `passing` feature;
- monotonic completion: a previously passing feature cannot silently regress;
- coverage of ADR topics required by `harness.config.json`;
- real `source_refs` for non-placeholder features.

Validation records the last successful feature state under `.harness/`, allowing later runs to
detect regressions.

> [!IMPORTANT]
> `validate` verifies repository state and evidence records. It does not execute the verification
> commands declared by a feature or prove that recorded evidence is truthful. Run those commands
> in your development and CI workflows, then record their results.

## The full SDLC workflow

The repository includes guidance for nine stages, but they are not a mandatory pipeline.
Stages 4, 6, 7, 8, and 9 are the **always-required core loop** for any feature. Stages 1,
2, 3, and 5 are **conditionally required** — each stage document states at the top when
it applies, and `AGENTS.md`'s Routing Map tells an agent which entry point fits the
change at hand (new capability vs. small fix vs. incident vs. resuming an existing
feature).

1. Requirements *(when scope is unclear)*
2. Architecture & Technical Design (ADRs) *(when the change is load-bearing)*
3. User Story Design *(when a capability benefits from decomposition first)*
4. Feature Breakdown — **always**
5. Milestone Planning *(when new or re-sequenced planning is actually needed)*
6. Agile Development (TDD) — **always**
7. Self-Acceptance Testing — **always**
8. Deployment — **always**
9. Observability & Feedback Loop — **always**

```mermaid
flowchart TB
    Slice["Feature slice\n(stage 4)"]
    A["1 Requirements"] -.optional.-> Slice
    B["2 Architecture / ADRs"] -.optional.-> Slice
    C["3 User Stories"] -.optional.-> Slice
    E["5 Milestone Planning"] -.optional.-> Slice
    Slice --> F["6 Agile TDD"]
    F --> G["7 Self-Acceptance"]
    G --> H["8 Deployment"]
    H --> I["9 Observability and Feedback"]
    I -."feedback can reopen 1 or 2".-> A
```

These documents guide the work; the machine-enforced rules currently focus on feature state,
dependencies, evidence records, source references, milestone order, and configured ADR coverage.

## Generated repository contract

After `init` or `adopt`, the repository contains:

<details>
<summary><strong>Show the generated files and hook setup</strong></summary>

```text
AGENTS.md                    # startup, routing, feature, and session rules
feature_list.json            # milestones, features, dependencies, status, and evidence
feature_list.schema.json     # machine-readable feature-list schema
harness.config.json          # project-level governance configuration
progress.md                  # session-by-session checkpoints
docs/
  adr/                       # architecture decision records
  workflow/                  # guides for the nine SDLC stages
.githooks/pre-commit         # runs validation before a commit
.github/workflows/deploy.yml # validates before the generated deployment job
.claude/skills/              # optional Claude Code discovery wrappers
```

The generated pre-commit hook is intentionally inactive until you configure it once:

```bash
git config core.hooksPath .githooks
```

</details>

## Commands

| Command                        | What it does                                                            |
| ------------------------------ | ----------------------------------------------------------------------- |
| `sdlc-harness init`          | Scaffold the complete harness in an empty or new repository.            |
| `sdlc-harness adopt`         | Add missing harness files without overwriting existing files.           |
| `sdlc-harness validate`      | Run every structural and governance check; exit non-zero on failure. The `passing_is_monotonic` check prefers a git baseline (`origin/main`/`main`, or `$HARNESS_BASE_REF`/`$GITHUB_BASE_REF`) over the local `.harness/` snapshot cache, so a regression PR can't sneak past a fresh CI checkout that has no snapshot to compare against. |
| `sdlc-harness status`        | Print milestone counts, feature counts, and the active feature as JSON. |
| `sdlc-harness new-feature`   | Interactively append a new feature to`feature_list.json`.             |
| `sdlc-harness new-milestone` | Interactively append a new milestone to`feature_list.json`.           |
| `sdlc-harness verify <feature-id>` | Actually run a feature's declared verification commands and record real pass/fail evidence (with exit code and commit sha) — the only supported way to add "test" evidence. |
| `sdlc-harness claim <feature-id>` | Atomically claim a feature (sets `owner`, moves `not_started` → `in_progress`), subject to the owner's WIP limit. |
| `sdlc-harness claim --next` | Atomically claim the highest-priority ready feature (not started, dependencies passing, unclaimed). |
| `sdlc-harness claim renew <feature-id>` | Extend a claim's lease before it expires. |
| `sdlc-harness claim <feature-id> --takeover-expired` | Take over a claim whose lease has expired. |
| `sdlc-harness release <feature-id>` | Release a claim (reverts `in_progress` back to `not_started`). |

All claim commands accept `--owner <name>` (defaults to `harness.config.json`'s `defaultOwner`), `--actor <id>` (distinguishes multiple Agent sessions run by the same owner — claim uniqueness is always per-feature, never per-actor), and `--ttl <minutes>` (lease length, default 120).

### Solo vs. team mode

`harness.config.json`'s `collaborationMode` controls whether claim/lease is visible:

- **`"solo"`** (the default): you never run `claim`/`release` yourself. `sdlc-harness verify` claims the feature for `defaultOwner` before running and releases it afterward, invisibly — the underlying CAS/claim safety is still there, it just never surfaces. If another owner actively holds the claim, `verify` still refuses to run rather than racing evidence writes against them.
- **`"team"`**: `verify` never manages claims implicitly. Claim a feature explicitly first (`sdlc-harness claim <feature-id>` or `claim --next`), then `verify`.

## Agent compatibility

| Agent                                     | Core workflow | Extra integration                             |
| ----------------------------------------- | ------------: | --------------------------------------------- |
| Claude Code                               |           Yes | One thin skill wrapper per workflow stage     |
| Codex and other`AGENTS.md`-aware agents |           Yes | Uses the repository contract directly         |
| Other file-aware coding agents            |           Yes | Instruct the agent to read`AGENTS.md` first |

The `.claude/skills/` wrappers contain no separate process logic. The canonical workflow remains
in `AGENTS.md` and `docs/workflow/`, preventing behavior from diverging between agents.

## What it is not

`sdlc-harness` is not a coding agent, test runner, hosted project-management service, or proof
that a product requirement is correct. It is the repository-level protocol and validation layer
that keeps agents, developers, Git hooks, and CI aligned on the same declared state.

## Contributing

Issues and pull requests are welcome. Run the test suite with:

```bash
npm test
```

## License

[MIT](LICENSE)
