# Pipeline Bootstrap Plan

> **For agentic workers:** Use `/todo` to see current progress. Each task is independent and session-sized.

**Goal:** Complete the superpowers pipeline setup for OopsTab

**Context:** Pipeline scaffolded on 2026-05-02. Skeleton CLAUDE.md is live with workflow rules. These tasks complete the deep analysis and finalize the setup.

A rich set of historical planning docs already exists in `Plans/` — Tasks 1, 2, and 5 should reuse that content rather than redo discovery.

---

### Task 1: Techstack Analysis

Deep-dive into the project's technical stack and write `docs/techstack.md`.

**Input:** `Plans/TechStackOverview.md`, `Plans/SoCGuide.md`, `Plans/StyleDesignOverview.md`, `package.json`, `tsconfig.json`, `webpack.config.js`, `.eslintrc.js`, `postcss.config.js`, sample 3-5 source files (background entry, one component, one util, one type module).

- [ ] **Read manifest files fully** — `package.json`, `tsconfig.json`, `webpack.config.js`, `.eslintrc.js`, `postcss.config.js`, `tailwind.config.js`
- [ ] **Read existing planning docs** — `Plans/TechStackOverview.md`, `Plans/SoCGuide.md`, `Plans/StyleDesignOverview.md` (these already capture much of the architecture intent)
- [ ] **Sample source files** — read main entry points (background service worker, oopstab page, options page), one typical component, one util, one type module, one test file if present. Note: import style, error handling, naming conventions, class vs function, type usage
- [ ] **Identify architecture patterns** — multi-entry webpack layout, message passing UI ↔ background, storage schema, type centralization rules
- [ ] **Draft techstack.md** — stack table, dependency philosophy, architecture rules (MV3 service worker constraints, CSP, polyfill usage), coding patterns, build & distribution (webpack + zip-extension + GH release workflow), rejected alternatives (MUI was considered, headless preferred per `Plans/TechStackOverview.md`)
- [ ] **Present to user for review**
- [ ] **Write `docs/techstack.md`**
- [ ] **Commit**: `docs: add techstack analysis`

### Task 2: Product Overview

Distill the product context and write `docs/overview.md`.

**Input:** `README.md`, `Plans/DevelopmentPlan.md`, `Plans/PoCChecklist.md`, `Plans/MVPChecklist.md`, code structure, git history.

- [ ] **Read README and existing planning docs fully** — especially `Plans/DevelopmentPlan.md` which is the de-facto product spec
- [ ] **Trace data flow** — entry point: background service worker listens to `chrome.tabs.*` / `chrome.windows.*` / `chrome.tabGroups.*` events → debounced snapshot creation → `chrome.storage.local`. UI (oopstab page + options) reads storage and sends restore/save messages to background.
- [ ] **Build module index** — scan `src/` (background, content, components/ui, options, pages/oopstab, types, utils, middleware-tab), one-line description each
- [ ] **Identify key boundaries** — chrome.* API surface, message types between UI and background, storage schema, middleware-tab redirect flow
- [ ] **Draft overview.md** — problem (browser session loss), solution (auto-snapshot per logical window), user (end-user), user flow (passive auto-save → manual save/rename → restore), data flow, module index, key boundaries
- [ ] **Present to user for review**
- [ ] **Write `docs/overview.md`**
- [ ] **Commit**: `docs: add product overview`

### Task 3: Enhance CLAUDE.md

Replace stub sections with full content derived from techstack and overview analysis.

**Depends on:** Task 1 and Task 2 (needs their output)

- [ ] **Write Coding Standards section** — derived from `Plans/SoCGuide.md` + actual code patterns (type centralization, Tailwind centralize-vs-inline rules, import style, message passing pattern)
- [ ] **Update Tech Stack section** — remove "pending" marker, point to `docs/techstack.md`
- [ ] **Update Planning section** — confirm references to `docs/overview.md`, `docs/techstack.md`, `docs/specs/index.md` are accurate
- [ ] **Verify doc sync wording** — ensure doc sync is a named pipeline step in every route (between user review and commit), with temporal cleanup paragraph
- [ ] **Add MV3-specific notes** — service worker lifetime, CSP constraints, storage quota, no-eval/no-inline-script rules
- [ ] **Add Style/Design ref** — point to `Plans/StyleDesignOverview.md` (or migrate to `docs/specs/style.md`)
- [ ] **Present changes to user**
- [ ] **Update CLAUDE.md**
- [ ] **Commit**: `docs: finalize CLAUDE.md with full analysis`

### Task 4: Skill / MCP / Hook Resolution

Auto-curate Claude Code tooling matched to detected stack. Harness-internal — user sees one batch, replies. No manual search, no plugin install gate.

**Depends on:** Task 1 (needs detected stack)

**Process — automated:**

1. **Take detected stack from Task 1** — TS 5 + React 18 + Tailwind 3 + Webpack 5 + Chrome MV3 extension, single package, solo dev.
2. **Curate recommendations** across:
   - Anthropic plugin marketplace (`claude-plugins-official`)
   - awesome-skills.com / skills.sh
   - tonsofskills.com / `ccpi` CLI
   - mcpmarket.com (MCP servers)
   - Fast-path: if `claude-code-setup` plugin installed, invoke `/setup` and merge its picks
3. **Filter to stack-matched only** — Chrome extension dev, React/TS, Tailwind, Webpack, MV3 service worker debugging. Drop generic / spray suggestions.
4. **Present batch to user with rationale per pick:**
   ```
   Recommendations for OopsTab (TS+React+Webpack+MV3):
     [SKILL]    name    — matched signal, one-line value
     [MCP]      name    — matched signal, one-line value
     [HOOK]     name    — matched signal, one-line value
     [SUBAGENT] name    — matched signal, one-line value
   Accept all / reject specific / discuss thoughts?
   ```
5. **Apply approved** via `claude plugin install <slug>@<market>` or settings edit.
6. **Commit if anything added.**

### Task 5: Seed Feature Specs

Write initial persistent specs for OopsTab's existing features.

**Depends on:** Task 2 (needs product overview to identify features)

Suggested seed specs (derived from `Plans/DevelopmentPlan.md` + current code):

- `window-tracking.md` — `oopsWindowId` UUID, mapping persistence, rebuild on startup
- `snapshot-creation.md` — event triggers, debouncing, capture format
- `snapshot-storage.md` — storage schema, quota policy, auto-prune (5-per-window limit), TTL
- `restore-flow.md` — focus-vs-create logic, tab/group/pinned restoration, middleware-tab role
- `manual-save-rename.md` — promote auto → saved, default naming `TopTabTitle - Timestamp`, validation
- `settings.md` — debounce interval, max snapshots, TTL, persistence
- `ui-shell.md` — management page layout, two-list view, options page

- [ ] **Confirm spec list with user** (some may be merged or skipped)
- [ ] **For each confirmed spec, write a spec** — product-level: intent, user flow, cross-module interactions, design decisions. Code-light — no API tables or implementation details.
- [ ] **Update `docs/specs/index.md`** — add each spec to the table with a one-liner describing what it covers
- [ ] **Present to user for review**
- [ ] **Commit**: `docs: seed persistent feature specs`

### Task 6: Build Doc

Write `docs/building.md` covering build/distribution.

- [ ] **Document local build** — `npm run dev` (watch), `npm run build` (production + zip)
- [ ] **Document zip flow** — `scripts/tools/zip-extension.js`, output naming, dist/ layout
- [ ] **Document version bump** — `scripts/tools/version-update.js`, manifest.json + package.json sync
- [ ] **Document GH release workflow** — `.github/workflows/release.yml` trigger, artifacts
- [ ] **Document Chrome Web Store upload steps** — manual checklist for store submission
- [ ] **Document loading unpacked dev build** — `chrome://extensions` instructions
- [ ] **Present to user**
- [ ] **Write `docs/building.md`**
- [ ] **Commit**: `docs: add build and distribution guide`

### Task 7: Cleanup

- [ ] **Delete this file** (`docs/superpowers/plans/bootstrap.md`) — bootstrap is complete
- [ ] **Verify `/todo` shows no active work** (unless real project work has started)
- [ ] **Commit**: `chore: complete pipeline bootstrap`
