---
name: frontend-soc-scan
description: 'Scan frontend code for domain logic that violates Frontend=Intent, Backend=Logic. Outputs structured violation report. Universal baseline — extend with project-specific patterns.'
disable-model-invocation: true
tags: [audit, scan, frontend, architecture, report]
stack: [typescript, javascript]
---

# Frontend SoC Scan

Scan frontend codepaths for domain logic leaks — business rules, thresholds, computations, and state derivations that belong in the backend or in shared pure-logic packages. Outputs a structured findings report. Does not fix anything.

## The Principle

**Frontend = Intent, Backend = Logic.**

- Frontend expresses user intent: tap, navigate, display.
- Backend owns all business decisions, computations, thresholds, and state transitions.
- Shared pure-logic packages own reusable algorithms and utilities (math, formatters, API client).
- Shared UI packages are rendering only — no data fetching, no business logic. Props in, JSX out.
- App shells are thin wrappers — they wire stores + router to shared content.

The line is: **if a decision affects product behavior, it belongs server-side.** The client receives computed state and renders it.

## When to Use

User invokes `/frontend-soc-scan` periodically:

- Before a milestone or release candidate
- After a batch of feature merges
- When a review rejection revealed SoC drift
- When onboarding a new contributor (baseline audit)

## Scan Scope

### Scope: exclusion-based

Scan **all** frontend source files (`*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.vue`, `*.svelte` — whatever the project uses) under app and package directories — except excluded paths. This ensures new folders are automatically included.

### Directories to SKIP (adapt per project)

| Category | Examples | Why |
|---|---|---|
| Backend code | `apps/backend/`, `server/`, `api/` | Backend is where logic belongs |
| Shared pure logic | SRS math, algorithm packages | Intentionally shared — correct placement |
| Infra utilities | Auth token handling, i18n config, locale setup | Cross-cutting infra, not domain logic |
| Build artifacts | `node_modules/`, `dist/`, `.next/`, `.expo/`, `build/` | Not source code |
| Test files | `*.test.*`, `*.spec.*`, `__tests__/` | Tests legitimately contain domain values as fixtures |

**On first run:** Inspect the project structure and propose a skip list. Present to user for confirmation before scanning.

## Anti-Pattern Categories

Search for these in priority order. Each category includes what to look for and how to distinguish violations from legitimate frontend concerns.

### Category 1: Hardcoded Thresholds and Magic Numbers (CRITICAL)

Domain constants that encode business decisions. These belong in backend config or API response payloads.

**Look for:** Numeric comparisons in conditionals that gate product behavior — graduation cutoffs, scoring thresholds, size limits on domain collections, interval/day thresholds, count caps.

**Not a violation:** UI layout constants (max visible items for rendering), animation durations, z-index values, pagination page sizes, constants that mirror a backend response field for display (mapping names to colors).

### Category 2: Business-Rule Conditionals (CRITICAL)

If/else or ternary expressions that encode domain decisions the backend should make.

**Look for:** Conditionals on domain state (mastery, tier, level, status), graduation/completion checks, eligibility/readiness checks, state transitions.

**Not a violation:** Empty state rendering (`items.length === 0`), loading/error state checks, platform branching (`Platform.OS`).

### Category 3: Domain Calculations in Frontend (HIGH)

Computations that derive domain state from raw data. The backend should return the computed result.

**Look for:** Algorithm-related calculations (scoring, rating, scheduling), domain state derivation from raw fields, date/time business logic (not display formatting), sorting/filtering by domain criteria (priority, urgency, due dates).

**Not a violation:** Date formatting for display, client-side search by user input (text search), sorting by user-selected UI criteria (alphabetical).

### Category 4: State Derivation That Belongs in Backend (HIGH)

Frontend computing derived state instead of receiving it pre-computed from the API.

**Look for:** Functions named `get/compute/calculate/derive` + domain concept, mapping internal state codes to domain labels, progress/stats computation from raw collections.

**Not a violation:** Store selectors that slice already-computed backend state, memoized UI derivations.

### Category 5: API Response Reshaping as Business Logic (MEDIUM)

Transforms in the API client or store that do more than format — they make domain decisions.

**Look for:** `.map`/`.reduce` calls that compute domain fields, merging/enriching responses with computed properties.

**Not a violation:** Case conversion, adding UI-only fields (`isExpanded`, `isSelected`), mapping enums to i18n keys.

### Category 6: Hardcoded Domain Values (LOW)

Domain enums, state names, category lists that should come from backend config or API responses.

**Look for:** Domain state/tier/mode string literals used in conditionals (not just display mapping), hardcoded domain lists that should come from backend.

**Not a violation:** State-to-color mapping tables (display concern), i18n key construction, TypeScript type definitions that mirror backend types.

## Scan Process

### Step 1: Build Project-Specific Grep Patterns

Before the first grep, read the project's domain:

1. Read `docs/techstack.md` and `docs/overview.md` (or equivalent) to understand the domain vocabulary.
2. Identify the project's core domain concepts — the nouns and verbs that define business logic.
3. Construct grep patterns from those domain terms, organized by category above.
4. Present the patterns to the user: "I'll search for these. Anything to add or skip?"

This step is what makes the scan project-aware without hardcoding domain knowledge in the skill file.

### Step 2: Automated Grep Pass

Run the constructed patterns across frontend source files, filtering by the project's file extensions. Skip all directories from the skip list.

### Step 3: Contextual Triage

For each grep hit, read 10 lines of surrounding context to classify:

- **VIOLATION** — Genuine domain logic in frontend. Needs remediation.
- **BORDERLINE** — Could be either UI intent or domain logic. Needs human judgment.
- **FALSE POSITIVE** — Legitimate frontend concern. Discard.

Classification heuristics:

- Is the value/logic used in a conditional that changes product behavior? → VIOLATION
- Is the value/logic used only for rendering (color, label, layout)? → FALSE POSITIVE
- Is the value received from backend and just being displayed? → FALSE POSITIVE
- Does removing this logic require a backend API change? → VIOLATION (confirms backend concern)
- Is this in a store? Does it compute new state or relay backend state? Compute = VIOLATION, relay = FALSE POSITIVE

### Step 4: Categorize and Prioritize

Group findings by category. Within each category, sort by severity:

- **P0 (fix now):** Active business-rule violation that could produce wrong behavior if backend changes
- **P1 (fix soon):** Domain logic that works today but creates coupling — backend can't evolve independently
- **P2 (track):** Minor domain awareness that's pragmatic but should be noted

## Output Format

```markdown
# Frontend SoC Scan Report

**Date:** {today}
**Project:** {project name}
**Scanned:** {directories scanned}
**Skipped:** {directories skipped}
**Patterns used:** {count} patterns across {count} categories

## Violations

| # | Category | Severity | File | Line(s) | Finding | Why it's a violation | Suggested fix direction |
|---|----------|----------|------|---------|---------|---------------------|------------------------|

## Borderline

| # | Category | File | Line(s) | Finding | Needs decision |
|---|----------|------|---------|---------|----------------|

## Summary

- Violations: {count} (P0: {n}, P1: {n}, P2: {n})
- Borderline: {count} (need human decision)
- False positives discarded: {count}

## Recommended Actions

{For each P0: what backend change is needed and what the frontend should change to.}
{For each P1: whether to fix now or defer.}
{For borderline items: the question to resolve and who should decide.}
```

## Post-Scan: Persist Report

Write the full report to a timestamped file. Suggested path:

```
docs/review/frontend-soc-{YYYY-MM-DD}.md
```

Create the directory if it doesn't exist. One file per run date — re-run on same day replaces the previous.

## What This Skill Does NOT Do

- **Does not fix violations.** Read-only scan. Outputs a report.
- **Does not scan backend code.** Backend is where logic belongs.
- **Does not scan test files.** Tests legitimately use domain values as fixtures.
- **Does not judge product decisions.** Flags placement, not correctness.
- **Does not require backend changes.** Identifies what needs to move, not how.

## Extending for Your Project

As the project grows, maintain this skill by:

1. Adding domain-specific grep patterns to the appropriate category
2. Adding domain concepts to "look for" lists
3. Adding project-specific skip paths as new infra directories appear
4. If a new category of violation emerges, add it with priority relative to existing categories

The categories and workflow are stable. The patterns grow with the domain.
