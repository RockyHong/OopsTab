# OopsTab Product Overview

Chrome extension that auto-saves the full state of every browser window (tabs, order, pinned, groups) and lets the user restore them later — even after the browser closes a window or session.

---

## Problem

Browsers have native session recovery, but it's fragile. Crashes, closed windows, and "Restore previous session" failures dissolve carefully arranged tab setups (research rabbit holes, coding sessions, dashboard layouts, manga reading queues) into flat history lists. Once you lose the structure, you don't get it back.

## Solution

Per-window passive auto-snapshot. Every window gets a persistent UUID (`oopsWindowId`) the moment it's opened. Whenever tabs/groups/state change, a debounced snapshot of that window is written to local storage. Closing the window writes a final snapshot. The user opens the OopsTab management page to see all known windows (open or closed), restore any of them, star important ones, rename them, or wipe them.

## User

End user — a regular browser user who lives in many tabs and gets burned when sessions disappear. Distributed via the Chrome Web Store. No login, no account, no cloud by default.

## Primary User Flows

### A. Passive auto-save (default)

1. User opens or works in a browser window.
2. Background service worker debounces (~2 s after last change) and writes a snapshot to `chrome.storage.local`.
3. User never interacts with OopsTab during this flow.

### B. Restore a window

1. User clicks the extension icon → `options.html` opens (the management UI).
2. User browses snapshot list (open windows + previously-closed windows).
3. User clicks **Restore** on a snapshot:
   - If a window with that `oopsWindowId` is already open → focus it.
   - Otherwise → create a new window, populate tabs via the middleware-tab redirect (lazy-load), reapply pinned state and tab groups (where supported), associate the new window with the original `oopsWindowId`.

### C. Promote, rename, star, delete

- **Star** an important snapshot — protected from auto-cleanup.
- **Rename** with a custom name (default falls back to top tab title + timestamp).
- **Delete** with confirmation modal.
- **Delete all** from settings.

### D. Settings

- Toggle `syncEnabled` (chunked write to `chrome.storage.sync`).
- Adjust `autosaveDebounce` *(currently config-only — see Tech Stack "Known Discrepancies")*.
- Export / import snapshot JSON for manual backup or migration.
- Toggle "OopsTab as homepage" — background overrides `chrome://newtab` and new-window default page to `options.html`.

### E. Dev-only debug

`DebugPanel` mounts at `/debug` route in development builds (`process.env.NODE_ENV === "development"`). Provides direct snapshot inspection, deduplication trigger, and storage stats.

---

## Data Flow

```
┌─ Browser events ─────────────────────────────────────────────┐
│  windows.onCreated      tabs.onCreated/onRemoved/onUpdated   │
│  windows.onRemoved      tabs.onAttached/onDetached           │
│                         tabGroups.onUpdated                  │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─ background/index.ts (MV3 service worker) ───────────────────┐
│  • windows.onCreated                                          │
│      → checkForReopenedWindow (URL-similarity to existing     │
│        snapshots, ≥70% match → reuse oopsWindowId)            │
│      → registerWindow (new UUID if not reopened)              │
│      → debouncedSnapshotCreation (2s)                         │
│  • tab/group events → debouncedSnapshotCreation               │
│  • tabs.onRemoved → cacheWindowState (with retry)             │
│  • windows.onRemoved (200ms settle) → createFinalWindowSnapshot│
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─ utils/snapshotManager ──────────────────────────────────────┐
│  • createWindowSnapshot: query tabs+groups → build TabData[] │
│    → mergeSnapshots (≥75% similarity merges into existing)   │
│    → saveAllSnapshots                                        │
│  • saveAllSnapshots → storage.local (always) + storage.sync  │
│    chunked (if syncEnabled)                                  │
│  • deduplicateSnapshots: pairwise similarity sweep on startup│
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─ chrome.storage.local ───────────────────────────────────────┐
│  oopsSnapshots:    SnapshotMap = {oopsWindowId → snapshot}   │
│  oopsWindowIdMap:  {chrome.windowId → oopsWindowId}          │
│  oopsConfig:       { autosaveDebounce, syncEnabled }         │
│  oopsStorageStats: { totalBytes, usedBytes, … }              │
│  oopsTabIsHomepage:boolean                                   │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─ UI (options.html via React Router) ─────────────────────────┐
│  /         → OopsTab page (snapshot list, restore, star,     │
│              rename, delete)                                 │
│  /settings → SettingsPanel (config, sync toggle, export/import,│
│              homepage toggle, delete all)                    │
│  /debug    → DebugPanel (dev only)                           │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─ Restore path: utils/restoreManager.restoreSession ──────────┐
│  • findOpenWindow → windows.update({focused:true})  OR       │
│  • createWindowFromSnapshot:                                 │
│      - filter http(s)-only tabs                              │
│      - first tab opens at middleware-tab.html?url=…&title=…  │
│      - remaining tabs created in order, also middleware       │
│      - tabGroups re-created via tabs.group + tabGroups.update│
│        (skipped on Firefox / when supportsTabGroups=false)   │
│      - new chrome.windowId mapped to original oopsWindowId   │
└──────────────────────────────────────────────────────────────┘
```

The middleware-tab indirection (`src/middleware-tab.{html,js}`) is a deliberate lazy-load: each restored tab loads the lightweight middleware page, which sets the title/favicon immediately and only navigates to the real URL when the tab becomes visible. This avoids hammering the network with N parallel page loads for a many-tab restore.

---

## Module Index

### `src/background/`
| File | Role |
|---|---|
| `index.ts` | MV3 service worker. Registers all browser-event listeners, runs debounced snapshot pipeline, handles homepage override, manages sync-storage roundtrip. |

### `src/content/`
| File | Role |
|---|---|
| `index.ts` | Placeholder content script. Currently empty; reserved for future page-level integration. |

### `src/pages/oopstab/`
| File | Role |
|---|---|
| `index.html` / `index.tsx` | Standalone webpack entry (renders `OopsTab`). Bundle exists but main UI is mounted via the options entry — kept as a separate target for potential future dedicated page. |
| `OopsTab.tsx` | Main snapshot management view: list of windows with cards, restore / star / rename / delete actions, tab preview, storage stats banner. |
| `DebugPanel.tsx` | Development-only debug UI. Tree-shaken from production via `process.env.NODE_ENV` check. |

### `src/options/`
| File | Role |
|---|---|
| `index.tsx` | Webpack entry — renders `Options` into `options.html` root. |
| `Options.tsx` | Top-level shell with HashRouter — mounts `OopsTab` at `/`, `SettingsPanel` at `/settings`, `DebugPanel` at `/debug` (dev). Owns the navigation bar and About modal. |
| `SettingsPanel.tsx` | Config form, storage stats, sync toggle, export/import, homepage toggle, delete-all. |

### `src/components/ui/`
Reusable design-system primitives. All Tailwind-styled, no MUI / shadcn / headless dependencies.

| File | Role |
|---|---|
| `Button.tsx` | Variants: `primary`, `passive`, `danger`. Sizes: `sm/md/lg`. |
| `Card.tsx` | Default container with shadow + rounded variants. |
| `IconButton.tsx` | Compact action button wrapping a Heroicon. |
| `Layout.tsx` | App shell layout primitives. |
| `ListItem.tsx` | Snapshot row layout (timestamp, tab count, top-tab preview). |
| `Modal.tsx` | Dialog + overlay (custom — no headlessui). |
| `Spinner.tsx` | Loading indicator. |
| `ThemeExample.tsx` | Showcase / reference of theme tokens. |
| `Toggle.tsx` | Switch component for boolean settings. |
| `Typography.tsx` | Text component using semantic Tailwind sizes. |
| `index.ts` | Barrel export. |

### `src/utils/`
| File | Role |
|---|---|
| `browserAPI.ts` | Re-exports `webextension-polyfill` as default; exports `isChrome` / `isFirefox` / `supportsTabGroups` flags. |
| `windowTracking.ts` | UUID generation, `oopsWindowIdMap` CRUD, startup rebuild, reopened-window detection (URL-similarity ≥70%). |
| `snapshotManager.ts` | Snapshot CRUD, sync-storage chunking, similarity-based merge (≥75%), deduplication sweep, cache-on-close, config + stats helpers, export/import. |
| `restoreManager.ts` | Focus-or-create restore, middleware-URL builder, tab-group re-creation. |
| `testingUtils.ts` | Helpers for the dev DebugPanel. |
| `classnames.ts` | `cn(...)` — clsx-equivalent class merger. |
| `index.ts` | Barrel + `debounce` utility. |

### `src/types/`
| File | Role |
|---|---|
| `snapshot.ts` | `TabData`, `TabGroupData`, `TabGroupColor`, `WindowSnapshot`, `SnapshotMap`, `OriginalTabData`. |
| `storage.ts` | `StorageStats`, `OopsConfig`, `STORAGE_KEYS`, `DEFAULT_*` constants. |
| `browser.ts` | `WindowIdMap`, `BrowserInfo`, `WindowMetrics`, `WindowStateCache`. |
| `ui.ts` | Component variant + size + theme + typography unions, `BaseComponentProps`, `ClassValue`. |
| `message.ts` | `BaseMessage` + per-action discriminated `Message` union. |
| `global.d.ts` | Ambient declarations. |
| `index.ts` | Barrel re-export. |

### `src/styles/`
| File | Role |
|---|---|
| `tailwind.css` | Tailwind entry (`@tailwind base/components/utilities`), imported by both UI bundles. |

### Top-level static / build
| Path | Role |
|---|---|
| `src/middleware-tab.html` | Lazy-load redirect page used during snapshot restore. |
| `src/middleware-tab.js` | Reads URL params, sets title/favicon, redirects on visibility change. CSP-compliant (separate file, no inline script). |
| `public/manifest.json` | MV3 manifest. Permissions: `tabs`, `storage`, `tabGroups`. CSP: `script-src 'self'; object-src 'self'`. |
| `public/options.html` | Host page for the React management UI. |
| `public/icons/` | Extension icons (16/32/48/128). |
| `webpack.config.js` | Multi-entry build (oopstab, options, background, content). |
| `tailwind.config.js` | Theme tokens (primary green palette, Outfit/Roboto, semantic typography). |
| `scripts/tools/zip-extension.js` | Builds `builds/<name>-<version>.zip` from `dist/`. |
| `scripts/tools/version-update.js` | Bump version + tag (levels 0/1/2/3). |
| `scripts/tools/clean-console-logs.js` | Pre-release log scrub. |
| `.github/workflows/release.yml` | On `v*` tag push → build → zip → GitHub release. |

### `Plans/` (historical)
Pre-bootstrap planning documents. Preserved for reference; new design work goes through `docs/specs/` and `docs/superpowers/`.

| File | Covers |
|---|---|
| `DevelopmentPlan.md` | Full PoC / MVP / Product phasing — original product spec. |
| `PoCChecklist.md`, `MVPChecklist.md` | Phase 1 / 2 implementation checklists. |
| `TechStackOverview.md` | Stack rationale. |
| `SoCGuide.md` | Type / style centralization rules (still in force). |
| `StyleDesignOverview.md` | Visual identity, color palette, typography. |

### `docs/` (Jekyll user-facing site)
Separate concern from this overview — public documentation served at `rockyhong.github.io/OopsTab/`.

---

## Key Boundaries

### Background ↔ UI

- UI components import from `utils/` directly (most calls go straight to `chrome.storage.local`); the discriminated `Message` union exists but is currently used sparingly. The boundary is **storage-level**, not message-level — both sides read/write the same keys, listening via `chrome.storage.onChanged`.
- This keeps the UI alive when the service worker is parked. A side effect: storage-key-typo bugs aren't caught at the boundary — always go through `STORAGE_KEYS.*`.

### Browser ↔ Polyfill

- All `chrome.*` calls go through `utils/browserAPI.ts` (`webextension-polyfill`).
- `tabGroups` calls must guard on `supportsTabGroups` (Firefox lacks the API).
- Chrome-only Manifest V3 features (service worker, tabGroups) are the implicit target; Firefox compatibility is best-effort.

### Snapshot ↔ Storage

- One `WindowSnapshot` per `oopsWindowId` (latest only — not historical chain).
- Sync storage uses chunked keys (`oopsSnapshots_chunk_N`) when serialized JSON exceeds 80 KB.
- `chrome.storage.local` quota: 5 MB default (queryable via `navigator.storage.estimate()`).

### Snapshot Identity

- Identity is the `oopsWindowId` (UUID), not the chrome `windowId` (which churns on every restart).
- Re-association on reopen: URL-set similarity ≥70% → reuse existing `oopsWindowId`.
- Pairwise snapshot merge: similarity ≥75% (URL match weighted 0.7, group similarity 0.3) → keep one, drop the other (prefer starred / named / more tabs / newer).

### Restore Flow

- Middleware-tab indirection means restored tabs don't immediately navigate — the real URL only loads on tab activation. This is product behavior, not a bug. Snapshot logic must un-wrap middleware URLs (`extractOriginalTabData`, `getNormalizedUrl`) when comparing snapshots, or every restore would double-snapshot.

### CSP

- `script-src 'self'; object-src 'self'`. No inline `<script>`, no `eval`, no remote scripts.
- This is why `middleware-tab.js` is a separate file rather than inline in `middleware-tab.html`.
