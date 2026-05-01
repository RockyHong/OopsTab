# Pipeline Bootstrap Plan

> **For agentic workers:** Use `/todo` to see current progress. Each task is independent and session-sized.

**Goal:** Complete the superpowers pipeline setup for OopsTab

**Context:** Pipeline scaffolded on 2026-05-02. Skeleton CLAUDE.md is live with workflow rules. These tasks complete the deep analysis and finalize the setup.

A rich set of historical planning docs already exists in `Plans/` — Tasks 1, 2, and 5 should reuse that content rather than redo discovery.

---

### Task 1: Techstack Analysis ✅

Deep-dive into the project's technical stack and write `docs/techstack.md`.

**Input:** `Plans/TechStackOverview.md`, `Plans/SoCGuide.md`, `Plans/StyleDesignOverview.md`, `package.json`, `tsconfig.json`, `webpack.config.js`, `.eslintrc.js`, `postcss.config.js`, sample 3-5 source files (background entry, one component, one util, one type module).

- [x] **Read manifest files fully** — `package.json`, `tsconfig.json`, `webpack.config.js`, `.eslintrc.js`, `postcss.config.js`, `tailwind.config.js`
- [x] **Read existing planning docs** — `Plans/TechStackOverview.md`, `Plans/SoCGuide.md`, `Plans/StyleDesignOverview.md` (these already capture much of the architecture intent)
- [x] **Sample source files** — read main entry points (background service worker, oopstab page, options page), one typical component, one util, one type module, one test file if present. Note: import style, error handling, naming conventions, class vs function, type usage
- [x] **Identify architecture patterns** — multi-entry webpack layout, message passing UI ↔ background, storage schema, type centralization rules
- [x] **Draft techstack.md** — stack table, dependency philosophy, architecture rules (MV3 service worker constraints, CSP, polyfill usage), coding patterns, build & distribution (webpack + zip-extension + GH release workflow), rejected alternatives (MUI was considered, headless preferred per `Plans/TechStackOverview.md`)
- [x] **Present to user for review** *(post-write — auto mode)*
- [x] **Write `docs/techstack.md`**
- [x] **Commit**: `docs: add techstack analysis`

### Task 2: Product Overview ✅

Distill the product context and write `docs/overview.md`.

**Input:** `README.md`, `Plans/DevelopmentPlan.md`, `Plans/PoCChecklist.md`, `Plans/MVPChecklist.md`, code structure, git history.

- [x] **Read README and existing planning docs fully** — especially `Plans/DevelopmentPlan.md` which is the de-facto product spec
- [x] **Trace data flow** — entry point: background service worker listens to `chrome.tabs.*` / `chrome.windows.*` / `chrome.tabGroups.*` events → debounced snapshot creation → `chrome.storage.local`. UI (oopstab page + options) reads storage and sends restore/save messages to background.
- [x] **Build module index** — scan `src/` (background, content, components/ui, options, pages/oopstab, types, utils, middleware-tab), one-line description each
- [x] **Identify key boundaries** — chrome.* API surface, message types between UI and background, storage schema, middleware-tab redirect flow
- [x] **Draft overview.md** — problem (browser session loss), solution (auto-snapshot per logical window), user (end-user), user flow (passive auto-save → manual save/rename → restore), data flow, module index, key boundaries
- [x] **Present to user for review** *(post-write — auto mode)*
- [x] **Write `docs/overview.md`**
- [x] **Commit**: `docs: add product overview`

### Task 3: Enhance CLAUDE.md ✅

Replace stub sections with full content derived from techstack and overview analysis.

**Depends on:** Task 1 and Task 2 (needs their output)

- [x] **Write Coding Standards section** — derived from `Plans/SoCGuide.md` + actual code patterns (type centralization, Tailwind centralize-vs-inline rules, import style, message passing pattern)
- [x] **Update Tech Stack section** — remove "pending" marker, point to `docs/techstack.md`
- [x] **Update Planning section** — confirm references to `docs/overview.md`, `docs/techstack.md`, `docs/specs/index.md` are accurate
- [x] **Verify doc sync wording** — ensure doc sync is a named pipeline step in every route (between user review and commit), with temporal cleanup paragraph
- [x] **Add MV3-specific notes** — service worker lifetime, CSP constraints, storage quota, no-eval/no-inline-script rules
- [x] **Add Style/Design ref** — point to `Plans/StyleDesignOverview.md` (or migrate to `docs/specs/style.md`)
- [x] **Present changes to user** *(post-write — auto mode)*
- [x] **Update CLAUDE.md**
- [x] **Commit**: `docs: finalize CLAUDE.md with full analysis`

### Task 4: Skill / MCP / Hook Resolution ✅

Pinned 4 plugins via project `.claude/settings.json` so cloud Claude Code reproduces the toolset:

- `superpowers@claude-plugins-official` — full pipeline (brainstorming, TDD, code-reviewer, executing-plans, systematic-debugging, etc.)
- `fullstack-dev-skills@fullstack-dev-skills` — react-expert, typescript-pro, secure-code-guardian, debugging-wizard
- `frontend-design@claude-plugins-official` — for new UI components
- `caveman@caveman` — communication style

CLAUDE.md "Preferred Skills" section names which skills to reach for first. Marketplace caveat: `fullstack-dev-skills` source not declared in extraKnownMarketplaces (was auto-registered on this machine); cloud / fresh installs may need manual source spec.

MCPs: `context7` already configured user-side — kept device-wide, not project-pinned. No additions.

Hooks: none added — existing user-level SessionStart / UserPromptSubmit hooks cover communication and quality checks.

### Task 5: Seed Feature Specs ✅

Wrote 5 specs (consolidated from suggested 7 — `manual-save-rename` and `settings` folded into `management-ui` since the surface is unified):

- [x] [`window-tracking.md`](../../specs/window-tracking.md) — UUID assignment, idMap, reopen detection
- [x] [`snapshot-lifecycle.md`](../../specs/snapshot-lifecycle.md) — triggers, debounce, merge, final-on-close, cache
- [x] [`snapshot-storage.md`](../../specs/snapshot-storage.md) — local + sync chunking, schema, conflict resolution, export/import, cleanup
- [x] [`restore-flow.md`](../../specs/restore-flow.md) — focus-or-recreate, middleware indirection, group restoration, identity re-association
- [x] [`management-ui.md`](../../specs/management-ui.md) — options.html shell, list view, settings, homepage override, debug panel
- [x] **Update `docs/specs/index.md`**
- [x] **Commit**: `docs: seed persistent feature specs`

### Task 6: Build Doc ✅

Wrote [`docs/building.md`](../../building.md) — local dev workflow, dist/builds/ layout, version-update levels, GH release pipeline, manual Web Store upload checklist, pre-release cleanup, file map.

- [x] **Document local build** — `npm run dev` (watch), `npm run build` (production + zip)
- [x] **Document zip flow** — `scripts/tools/zip-extension.js`, output naming, dist/ layout
- [x] **Document version bump** — `scripts/tools/version-update.js`, manifest.json + package.json sync
- [x] **Document GH release workflow** — `.github/workflows/release.yml` trigger, artifacts
- [x] **Document Chrome Web Store upload steps** — manual checklist for store submission
- [x] **Document loading unpacked dev build** — `chrome://extensions` instructions
- [x] **Write `docs/building.md`**
- [x] **Commit**: `docs: add build and distribution guide`

### Task 7: Cleanup

- [ ] **Delete this file** (`docs/superpowers/plans/bootstrap.md`) — bootstrap is complete
- [ ] **Verify `/todo` shows no active work** (unless real project work has started)
- [ ] **Commit**: `chore: complete pipeline bootstrap`
