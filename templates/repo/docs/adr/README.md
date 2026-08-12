# ADR Index

One row per ADR in this directory. Append a row when a new ADR is created; update the
`Status` column when an ADR is accepted or superseded. Never delete a row — an ADR that
is superseded stays listed, with a link to what replaced it.

| ID   | Title | Topic | Status | Supersedes | Superseded By |
| ---- | ----- | ----- | ------ | ---------- | ------------- |
| 0001 | <short title> | <topic> | accepted | — | — |

Status values: `proposed`, `accepted`, `superseded`. See `template.md` for the ADR shape
and the append-only rule that governs edits to accepted ADRs.
