# OopsTab

Chrome Extension (Manifest V3) that auto-saves window/tab state and restores sessions. React + TypeScript + Tailwind + Webpack.

## Development Workflow

Before starting any work, **assess the task size and propose a route for the user to confirm.** Present it like:

```
This looks [small/medium/large] because [reason].
Route: [steps]
Impact: [what changes, how many files, risk level]
OK to proceed?
```

### Routes

**Small** — Single file, clear intent, no design decisions
→ implement → user review → doc sync → `/commit`

**Medium** — Multi-file, some design choices, completable in one session
→ Brainstorm (quick, inline) → implement → user review → doc sync → `/commit`

**Large** — Multi-session, architectural, unclear scope
→ Full pipeline: brainstorm → spec → plan → execute → user review → doc sync → `/commit`
→ Specs go to `docs/superpowers/specs/`, plans to `docs/superpowers/plans/`

The user always picks the route.

**User instructions override Superpowers defaults.**

### Doc Sync (non-negotiable)

This is a named pipeline step — every route includes it between user review and commit.

**Before every commit**, scan `docs/` for files that describe behavior touched by the diff (specs, overview, techstack, building). If any doc is potentially stale:

1. Report it to the user — doc path, what looks outdated, relevant diff context
2. Resolve together — update the doc or acknowledge it's still accurate
3. Never silently fix. Never silently skip. Stale docs are worse than missing ones.

**Temporal cleanup:** If the current work completes a feature branch, delete its spec and plan files from `docs/superpowers/specs/` and `docs/superpowers/plans/`. These are work orders — once merged, they're noise.

This is the pipeline's core discipline. Implementation without doc sync is incomplete.

## Context Hygiene

Multi-needle recall (cross-file reasoning, remembering earlier decisions) degrades past ~200k input tokens regardless of model version. Token cost is solved by prompt cache (~90% savings on hits); quality is the remaining constraint. Rules:

- **Subagent-first** when work is verbose — reading 10+ files, running noisy test suites, parallel-safe chunks, fresh-eye review. Subagent gets fresh context window; orchestrator stays sharp. Skip for <3-5k token tasks (init overhead 5-15k tokens swamps gain).
- **Compact while warm.** Run `/compact` only inside cache TTL (5min default, 1hr extended). Idle compact pays full price to summarize then writes back — wasteful. If you've been away, prefer `/clear` over `/compact`.
- **Clear on topic shift.** Cache is wasted across topic boundaries anyway. Free quality reset.
- **Split sessions** when next phase is a different domain. Cheaper and sharper than dragging accumulated context.
- **Park before /clear** mid-implementation. Write a short handoff note (current state, next step, open questions) so the next session can resume.

Default ordering when context feels heavy: subagent dispatch → compact (if warm) → clear (if cold or topic shifted) → park (if mid-implementation work at risk).

## Coding Principles

Behavioral guardrails to reduce common LLM coding mistakes. Adapted from Andrej Karpathy's observations. Bias toward caution over speed; for trivial tasks use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple valid interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite.

Test: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- When your changes orphan imports/vars/functions, remove them. Don't remove pre-existing dead code unless asked.

Test: every changed line traces directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Edit Discipline — Renames & Replace-All

`Edit replace_all: true` is naive whole-file string replace — no AST, no scope, no token boundaries. Running on common identifiers silently corrupts unrelated code (`state` → `swipe` rewrites `SwipeState` to `SwipeSwipe`, import paths, comments, CSS selectors). The trap is invisible until the next type-check.

### Rule (preference order)

1. **LSP rename** — symbol-aware, scope-respecting. Best for typed languages (TS, Rust, Go, Java, Python with pyright, C#).
2. **Per-occurrence Edit with unique surrounding context** — when LSP unavailable. Find each call site via Grep, Edit each with enough surrounding text that `old_string` is unique to that call.
3. **`sed` or scripted bulk replace** — only when term is **8+ characters and unique to the domain** (`Conversation`, `MerchandiseInventory`). Always case-preserving pair: `s/OldName/NewName/g; s/oldName/newName/g; s/OLD_NAME/NEW_NAME/g`. Run build/test cycle immediately.
4. **`Edit replace_all: true`** — only on unique long string literals (URLs, full sentences, hash IDs). Never on identifiers shorter than 8 characters. Never on common English words.

### Pre-flight checklist (any bulk replace)

1. Grep the exact term. Look at count + sample matches.
2. If hits >5 OR length <8 OR common English word → switch to options 1–3.
3. Scan sample matches for false positives (substring inside other identifiers, inside string literals, inside CSS class names that overlap with HTML tags, inside comments).
4. If any doubt remains → per-occurrence Edit. Token cost of caution is far less than cost of debugging silent corruption.

### Banned terms for `replace_all` (always per-occurrence review)

`state`, `name`, `data`, `value`, `item`, `key`, `id`, `type`, `props`, `node`, `text`, `link`, `error`, `result`, `body`, `head`, `main`, `time`, `path`, `file`, `index`, `count`, `child`, `style`, `class`, `tag`, `event`, `target`, `source`, `from`, `to`, `next`, `prev`, `init`, `done`.

### When a `replace_all` slips through

1. `git diff` first — see damage scope.
2. If uncommitted, `git checkout` the file and redo with the right tool.
3. If committed, fix as a NEW commit, not amend (preserves mistake in history).
4. Run type-check / lint / test — usually points straight at remaining corruption.

### Build/test as safety net

Always run after bulk operations. TS: `npm run lint && npm run build`.

## Solo Dev Assumptions

This project is operated by a single developer across multiple Claude Code sessions.

- **No PR self-review** — commit directly to working branch
- **Simple branching** — `main` + feature branches, no rebasing
- **No force push** — every commit is sacred, no rewriting history
- **Session isolation** — each Claude session commits only its own changes
- **No merge conflicts expected** — if one occurs, stop and ask the user

## Preferred Skills

Project pins these plugins via `.claude/settings.json` (`enabledPlugins`) so cloud Claude Code and fresh machines reproduce the toolset. Within those plugins, reach for these skills first:

| Skill | When |
|---|---|
| `superpowers:brainstorming` | Required by Medium / Large routes before any code |
| `superpowers:writing-plans` / `executing-plans` | Large-route work spanning multiple sessions |
| `superpowers:test-driven-development` | Adding tests (PoC/MVP checklists show test gaps) |
| `superpowers:code-reviewer` | Diffs >50 lines or any storage-schema change |
| `superpowers:systematic-debugging` | MV3 service-worker / restore / sync-storage bugs |
| `fullstack-dev-skills:react-expert` | React 18 component work (hooks, memo, perf) |
| `fullstack-dev-skills:typescript-pro` | Type-system tightening, generics, narrowing |
| `fullstack-dev-skills:secure-code-guardian` | CSP, web-accessible-resources, storage-handling changes |
| `fullstack-dev-skills:debugging-wizard` | Cold-start listener loss, async-listener races |
| `frontend-design:frontend-design` | New components in `src/components/ui/` matching `Plans/StyleDesignOverview.md` |

Pinned plugins: `superpowers`, `fullstack-dev-skills`, `frontend-design`, `caveman`. Whole-plugin pin keeps each pipeline intact (skills cross-reference each other inside a plugin).

> **Marketplace note:** `fullstack-dev-skills@fullstack-dev-skills` source is not declared in `extraKnownMarketplaces`. Cloud sessions / fresh machines may need to add its source manually if Claude can't auto-resolve.

## Coding Standards

Project-specific patterns. New code matches existing conventions; deviating needs a reason.

### Components

```tsx
// Function components with React.FC, default export, variant lookup objects.
const Button: React.FC<ButtonProps> = ({ variant = "primary", size = "md", ... }) => {
  const variantClasses = { primary: "...", passive: "...", danger: "..." };
  return <button className={cn("rounded-md font-medium", variantClasses[variant], ...)} {...props} />;
};
export default Button;
```

- Function components (`React.FC<Props>`); no class components.
- Default export for the primary symbol; named exports for helpers.
- Props extend the relevant DOM `*HTMLAttributes` plus `BaseComponentProps` (`className`, `children`).
- Variants are object lookups, not switch statements.
- `cn(...)` from `src/utils/classnames.ts` for conditional classes.

### Type Centralization (per `Plans/SoCGuide.md`)

| Centralize in `src/types/` | Inline |
|---|---|
| Shared across UI ↔ background | Used in a single component or function |
| Persisted to `chrome.storage.*` | Not exported anywhere |
| Domain models (snapshot, session, window, tab) | Component-specific prop shapes |
| Message contract between UI and background | One-shot helper return types |

Files: `snapshot.ts`, `storage.ts`, `browser.ts`, `ui.ts`, `message.ts` — re-exported via `src/types/index.ts`.

### Tailwind

Centralize / inline rule:

- **Centralize** — repeating variants, design-system components (`Button`, `Card`), token-based class sets. Live in `src/components/ui/` or `tailwind.config.js`.
- **Inline** — layout structure unique to a JSX block (`flex flex-col gap-4 p-4`).

Always use semantic theme tokens (`bg-primary`, `text-text-primary`, `bg-surface`) — never raw hex. Custom semantic typography sizes (`text-heading-1..6`, `text-body-lg/sm`, `text-caption`) bundle font-weight + line-height; prefer them over manual stacking. Style references: `Plans/StyleDesignOverview.md` (visual identity, color palette, typography).

### Async / Error Handling

- `async/await` throughout. Use `.then().catch()` only at top-level fire-and-forget call sites in the service worker (where `await` would block listener registration).
- Errors logged via `console.error("<contextual prefix>:", err)` and swallowed when the listener can recover.
- Top-level promise chains always have a `.catch` — unhandled rejections in MV3 service workers are noisy and cost credibility in store reviews.

### Imports

- Relative imports dominate (`../utils`, `../../types`). The `@` alias is registered in webpack but rarely used.
- Re-export through barrels (`src/types/index.ts`, `src/utils/index.ts`, `src/components/ui/index.ts`).
- Default browser API import: `import browser from "../utils/browserAPI"`.

## Project Structure

```
OopsTab/
├── public/              ← static extension assets (manifest.json, icons, options.html)
├── src/
│   ├── background/      ← MV3 service worker (snapshot triggers, window tracking)
│   ├── content/         ← content scripts
│   ├── components/ui/   ← reusable React components (Button, Card, Modal, …)
│   ├── options/         ← options page (settings UI)
│   ├── pages/oopstab/   ← main management page (snapshot lists, debug panel)
│   ├── styles/          ← Tailwind entry
│   ├── types/           ← centralized TS types (snapshot, browser, ui, message)
│   ├── middleware-tab.* ← redirect/recovery middleware page
│   └── utils/           ← helpers (storage, snapshot logic, formatting)
├── scripts/tools/       ← build helpers (zip-extension, version-update, clean-console-logs)
├── Plans/               ← historical planning docs (DevelopmentPlan, MVPChecklist, …)
├── docs/                ← Jekyll user-doc site + new pipeline docs (overview, techstack, specs/, superpowers/, building)
├── webpack.config.js
├── tsconfig.json
└── package.json
```

## Tech Stack

TS 5 (strict) + React 18 + Tailwind 3 + Webpack 5 + webextension-polyfill. Multi-entry MV3 extension (background, content, options, oopstab). Lint: ESLint 9. Distribution: webpack production → `scripts/tools/zip-extension.js` → `builds/`. GH Actions release on `v*` tag.

→ Full analysis with stack table, dependency philosophy, architecture rules, coding patterns, and known discrepancies in [`docs/techstack.md`](docs/techstack.md).

## MV3 Architecture Rules

These are non-negotiable — violating them silently breaks the extension.

1. **Don't import `chrome.*` directly** — go through `src/utils/browserAPI.ts` so polyfill + feature-detect stay consistent.
2. **Listeners register at top level of `src/background/index.ts`** — never inside conditional async wrappers, or events get lost when the service worker wakes from cold.
3. **No DOM APIs in `background/`** — service worker context only. No `window`, no `document`, no `localStorage`. Use `chrome.storage.local`.
4. **No persistent module-scope state in the worker** — it can be killed at any time. Persist anything you need to remember.
5. **No inline `<script>` and no `eval`** — CSP is `script-src 'self'; object-src 'self'`. That's why `middleware-tab.js` is a separate file.
6. **`tabGroups` calls must guard on `supportsTabGroups`** — Firefox lacks the API.
7. **Domain types live in `src/types/`** — don't re-declare `WindowSnapshot`, `TabData`, `OopsConfig`, etc. in component files.
8. **Theme tokens, not hex values** — new colors go into `tailwind.config.js` first, then components reference `bg-primary`, `text-text-primary`, etc.
9. **`cn()` for conditional classes** (from `src/utils/classnames.ts`) — `clsx` is not installed.
10. **Add new persisted keys to `STORAGE_KEYS`** in `src/types/storage.ts` — string literals scattered across files cause silent typos.

## Commands

```bash
npm run dev      # webpack --watch, development mode
npm run build    # production build + zip-extension
npm run lint     # eslint .ts/.tsx
```

## Git Notes

- **Only commit current session's changes** — if unrelated uncommitted changes exist from prior work, leave them alone
- **Atomic commits** — one logical change per commit
- **Conventional commits** — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- **Note:** `package-lock.json` is intentionally deleted on the current branch (commit `1d3f061 fix package problem`) — leave it alone

## Planning

- [`docs/overview.md`](docs/overview.md) — Product context, user flows, data flow diagram, module index, key boundaries.
- [`docs/techstack.md`](docs/techstack.md) — Stack table, dependency philosophy, architecture rules, coding patterns, build & distribution, known discrepancies.
- [`docs/specs/`](docs/specs/index.md) — **Persistent feature specs** — source of truth per feature.
- `docs/building.md` — Build/distribution instructions *(seeded by bootstrap Task 6)*.
- `docs/superpowers/specs/` — Design specs from brainstorming (temporal — deleted after merge).
- `docs/superpowers/plans/` — Implementation plans (temporal — deleted after merge).
- `Plans/` — Historical planning docs (`DevelopmentPlan.md`, `MVPChecklist.md`, `PoCChecklist.md`, `SoCGuide.md` *(coding rules still in force)*, `StyleDesignOverview.md` *(visual identity reference)*, `TechStackOverview.md`). Preserved for reference; new work uses `docs/`.

> **Two kinds of specs:** `docs/specs/` = permanent source of truth (updated as features evolve). `docs/superpowers/specs/` = temporal work orders (deleted after merge).
