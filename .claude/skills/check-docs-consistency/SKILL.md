---
name: check-docs-consistency
description: 'Cross-reference project docs for drift, stale references, and contradictions. Outputs timestamped report. Universal baseline — works with any docs/ structure from sp-bootstrap.'
disable-model-invocation: true
tags: [audit, scan, docs, periodic, report]
---

# Check Docs Consistency

Stateless scan. Read docs, cross-reference, write timestamped report. User decides what to fix. Report-only — no resolution.

## When to Use

User invokes `/check-docs-consistency` when:

- Starting a new feature pipeline (verify source of truth before writing specs)
- Drift pain surfaces ("wait, didn't we decide the opposite?")
- After a batch of merges that touched multiple docs
- Periodically as a health check (weekly or per-milestone)

## Baseline Assumptions

This skill assumes the `docs/` structure established by `/sp-bootstrap`:

```
docs/
  overview.md          ← product context, data flow, module index
  techstack.md         ← tech choices, architecture rules
  superpowers/
    specs/             ← temporal design specs (deleted after merge)
    plans/             ← temporal implementation plans (deleted after merge)
  specs/               ← persistent feature specs (if scaffolded)
    index.md
  building.md          ← build instructions (if scaffolded)
  help/                ← user guides (if scaffolded)
```

Projects may have additional doc directories. The scan adapts — it reads whatever `*.md` exists under `docs/` and in orchestration files.

## Procedure

### Step 1: Discover and Read All Docs (one pass)

Glob all `*.md` under `docs/`. Also read orchestration files: `CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/**/SKILL.md`.

Read each file once. While reading, extract everything into a working set:

**Universal extractions (every project):**

- Cross-references (file paths, `§Section` refs, markdown links to other docs)
- `docs/` path references in orchestration files (CLAUDE.md, agent MDs, skill MDs)
- Ownership/guardrail statements in CLAUDE.md
- Feature/module names mentioned across multiple docs
- File paths referenced in any doc

**Project-aware extractions (discover from what exists):**

- API endpoint patterns (`GET /...`, `POST /...`) if the project has backend docs
- Database/schema paths if the project has data docs
- Component/module names if the project has frontend/architecture docs
- Field/concept names that appear in multiple docs (potential mismatch surface)
- Screen/route names if the project has UI docs
- Config/env references if the project has deployment docs

The goal: build a map of "what references what" across the doc surface. Don't predetermine the categories — discover them from what the project actually documents.

### Step 2: Cross-Reference

All validations run against the extracted set. Every finding comes from comparing what one doc says against what another doc says — contradictions, orphans, mismatches. Deduplicate: same file+line appears once under the highest-priority match.

**P0 — Would Cause Bugs If Trusted:**

- Cross-reference to nonexistent doc or section (broken link)
- Same concept defined differently in two docs (contradictory definitions)
- API endpoint/route in one doc but missing or different in another
- Schema/field in one doc that contradicts another doc's schema

**P1 — Would Waste Dev Cycles:**

- Concept referenced as if it exists but has been removed or renamed in another doc
- Component/module in one catalog but missing from another
- Orphan doc (not referenced by any other file, not an index)
- Stale `docs/` path in orchestration files (file missing, glob has no matches)
- Removed feature/screen still referenced elsewhere
- Temporal artifact (`superpowers/specs/`, `superpowers/plans/`) with no matching active work (stale leftover)

**P2 — Slow-Burn Confusion:**

- Field/concept name mismatch for the same thing across docs (e.g., `targetLang` vs `targetLanguage`)
- Ownership contradiction in CLAUDE.md (two docs claiming to own the same concern)
- Internal terminology leaking where user-facing language is expected (or reverse)
- Handoff/WIP folder with no matching feature branch

**P3 — Cosmetic / Completeness:**

- Doc section referenced in index but empty or stub
- Feature documented in specs but absent from overview module index
- Missing expected cross-references (doc mentions a concept but doesn't link to the doc that defines it)

### Step 3: Write Report

Write the report to:

```
docs/review/docs-consistency-{YYYY-MM-DD}.md
```

Create the `docs/review/` directory if it doesn't exist. One file per run date — re-run on same day replaces the previous.

Present summary to user in chat. The persisted file is the source of truth for status tracking.

## Report Format

```markdown
# Doc Consistency Report

**Date:** {today}
**Project:** {project name}
**Docs checked:** {list of docs read}

## P0 — Would Cause Bugs If Trusted

| # | File(s) | Line(s) | Finding |
|---|---------|---------|---------|

## P1 — Would Waste Dev Cycles

| # | File(s) | Line(s) | Finding |
|---|---------|---------|---------|

## P2 — Slow-Burn Confusion

| # | File(s) | Line(s) | Finding |
|---|---------|---------|---------|

## P3 — Cosmetic

| # | File(s) | Line(s) | Finding |
|---|---------|---------|---------|

## Summary

- P0: {count}
- P1: {count}
- P2: {count}
- P3: {count}
- Total: {count}

## Recommended Actions

{For each P0/P1 finding: what to fix and which doc owns the truth.}
{For borderline items: the question to resolve and who should decide.}
```

## Scope

- Report is a file. Resolution is the user's call.
- Flags inconsistency, not correctness. Decisions are the user's.
- Doc-to-doc cross-reference only. Code is out of scope.
- Stateless between scans. Each run produces a fresh timestamped report.

## Extending for Your Project

As the project's doc surface grows:

1. Add project-specific extraction targets to Step 1 (domain terms, schema paths, route patterns)
2. Add project-specific checks to the appropriate P-level in Step 2
3. If the project has a custom doc structure beyond sp-bootstrap baseline, update the assumptions section

The workflow and priority framework are stable. The extraction targets and checks grow with the project.
