# OopsTab Tech Stack

Browser extension (Manifest V3) snapshotting full window/tab state. Component-driven UI, type-safe, cross-browser-shimmed, single-package monorepo-free layout.

---

## Stack Table

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Language | TypeScript | 5.1 | `strict: true`, ES6 target, `esnext` modules, `react-jsx` |
| UI framework | React | 18.2 | Functional components + hooks; no class components |
| Routing (UI pages) | react-router-dom | 7.5 | Used inside the management page |
| Styling | Tailwind CSS | 3.x | Heavy theme extension (semantic tokens) |
| CSS pipeline | PostCSS + autoprefixer | — | Driven by `postcss.config.js` / `.postcssrc` |
| Icons | @heroicons/react | 2.0 | Solid set preferred |
| Browser API shim | webextension-polyfill | 0.12 | Re-exported from `src/utils/browserAPI.ts` |
| Build | Webpack | 5 | `ts-loader`, multi-entry, asset/resource for images |
| HTML | html-webpack-plugin | 5 | One per UI entry (oopstab, options) |
| Copy assets | copy-webpack-plugin | 11 | `manifest.json`, `middleware-tab.*`, icons, assets |
| Lint | ESLint 9 + @typescript-eslint 8 | — | Legacy `.eslintrc.js` (not flat config) |
| Distribution | archiver | 7 | `scripts/tools/zip-extension.js` builds `builds/<name>-<version>.zip` |

### Removed / never-adopted

The original `Plans/TechStackOverview.md` mentioned MUI, `@headlessui/react`, `shadcn/ui`, and `clsx`. None landed:

- **MUI / headless UI** — replaced with a hand-rolled `src/components/ui/` set (Button, Card, Modal, Toggle, Spinner, Layout, ListItem, Typography, IconButton).
- **clsx** — replaced with `src/utils/classnames.ts` (`cn(...)`) which implements equivalent flatten/filter/object behaviour.
- **darkMode** — Tailwind config does not enable it; product is single-theme.

---

## Architecture

### Multi-Entry Webpack

`webpack.config.js` builds four entries, each emitted as `dist/<entry>.js`:

```
oopstab    → src/pages/oopstab/index.tsx     (main management UI, served via oopstab.html)
options    → src/options/index.tsx           (settings/options page, served via options.html)
background → src/background/index.ts         (MV3 service worker)
content    → src/content/index.ts            (content script — currently a placeholder)
```

Plus copied static files: `manifest.json`, `middleware-tab.html`, `middleware-tab.js`, optional `public/assets/`, optional `public/icons/`.

`HtmlWebpackPlugin` injects each UI bundle into its template; `CopyWebpackPlugin` ships everything else verbatim. `DefinePlugin` exposes `process.env.NODE_ENV` for dev-only debug rendering. The alias `@` → `src` is registered but most code uses relative imports.

Source maps are emitted only in development. Production builds enable `optimization.usedExports` for tree-shaking.

### MV3 Service Worker Constraints

`src/background/index.ts` is the long-lived event router. Critical rules:

- **No DOM, no window, no localStorage.** Use `chrome.storage.local` (or `chrome.storage.sync`).
- **No persistent state in module scope** — the worker can be killed and restarted at any time. Treat every listener as cold-callable. Persist anything you want to remember.
- **No `eval`, no inline `<script>`.** CSP set in `manifest.json` is `script-src 'self'; object-src 'self'`. This is why `middleware-tab.js` is a separate file rather than inline.
- **Listeners must be registered synchronously at top level** — registering inside async callbacks risks losing events when the worker wakes from cold.

### Cross-Browser Shim

All browser API access goes through `src/utils/browserAPI.ts`, which re-exports `webextension-polyfill` as the default. The same module exports `isChrome` / `isFirefox` / `supportsTabGroups` flags from a UA + feature-detect pass. Code paths that depend on `chrome.tabGroups` must check `supportsTabGroups` (Firefox lacks it).

### Type Centralization

Domain types live in `src/types/`, re-exported through `src/types/index.ts`:

```
types/
  snapshot.ts   TabData, TabGroupData, WindowSnapshot, SnapshotMap, OriginalTabData
  storage.ts    StorageStats, OopsConfig, STORAGE_KEYS, DEFAULT_*
  browser.ts    WindowIdMap, BrowserInfo, WindowMetrics, WindowStateCache
  ui.ts         ButtonVariant, Size, CardVariant, ThemeColor, TypographyVariant, BaseComponentProps, ClassValue
  message.ts    BaseMessage + per-action discriminated union (Message)
  global.d.ts   ambient declarations
```

Centralization rules (from `Plans/SoCGuide.md`, still in force):

- **Centralize** types shared across UI ↔ background, types persisted to storage, or domain models (snapshot, session, window).
- **Inline** types used inside a single component or function.

`src/utils/index.ts` re-exports a subset of types and constants for backward compatibility — new code should import from `../types` directly.

### Storage Schema

Two backends, selectable via `OopsConfig.syncEnabled`:

- `chrome.storage.local` — primary, ~5 MB quota, no per-item limit beyond the bucket total.
- `chrome.storage.sync` — optional, chunked because per-item quota is much smaller. The sync path uses keys of the form `oopsSnapshots_chunk_N` plus `oopsSnapshots_chunks` for the chunk count.

Snapshot model (current code, **simpler than the early Plans docs**):

```ts
SnapshotMap = { [oopsWindowId: string]: WindowSnapshot }
WindowSnapshot = { timestamp, tabs, groups, customName?, isStarred? }
```

One snapshot per logical window — not an array of historical snapshots. The "5 auto-snapshots per window" cap from `Plans/MVPChecklist.md` describes the original design; the shipped storage shape collapsed to a single live snapshot per window.

Storage keys are constants in `src/types/storage.ts`:

```
SNAPSHOTS_KEY      = "oopsSnapshots"
CONFIG_KEY         = "oopsConfig"
STORAGE_STATS_KEY  = "oopsStorageStats"
WINDOW_ID_MAP_KEY  = "oopsWindowIdMap"
```

Plus the loose flag `oopsTabIsHomepage` (used by background to toggle new-tab/new-window override).

### Message Pattern

UI ↔ background communication uses a discriminated union over `type`:

```ts
interface BaseMessage { type: string; requestId?: string }
type Message = CreateSnapshotMessage | GetSnapshotMessage | DeleteSnapshotMessage
             | RenameSnapshotMessage | ToggleStarMessage
             | SuccessResponse | ErrorResponse
```

Add a new action by extending `Message` in `src/types/message.ts` — handlers narrow on `msg.type`.

### Middleware Tab

`src/middleware-tab.html` + `src/middleware-tab.js` are loaded as a `web_accessible_resource`. During snapshot restore, tabs are opened to `middleware-tab.html?url=...&title=...&favicon=...` so the title/favicon render immediately while the real URL is deferred until the user activates the tab. On `visibilitychange → visible`, the page redirects to the real URL. This avoids hammering all tabs at once on a multi-tab restore.

### Window Tracking (`oopsWindowId`)

A persistent UUID per logical window, stored in `oopsWindowIdMap` (`{ [chrome.windowId]: oopsWindowId }`). Rebuilt on startup via `chrome.windows.getAll`. `checkForReopenedWindow` is called on `windows.onCreated` to detect Chrome-history reopens and reuse the existing `oopsWindowId` instead of allocating a new one.

### Snapshot Triggers (background)

Listeners fire on `tabs.onCreated/onRemoved/onUpdated/onAttached/onDetached`, `tabGroups.onUpdated` (when supported), and `windows.onCreated/onRemoved`. Each call enters `debouncedSnapshotCreation` (currently **2000 ms hardcoded** in `src/background/index.ts`, even though `OopsConfig.autosaveDebounce` defaults to 5000 ms — see Known Discrepancies below). On `windows.onRemoved`, a separate `createFinalWindowSnapshot` path runs after a 200 ms settle to capture the dying window's last state.

---

## Coding Patterns

### Component Conventions

```tsx
const Button: React.FC<ButtonProps> = ({ variant = "primary", size = "md", ... }) => {
  const variantClasses = { primary: "...", passive: "...", danger: "..." };
  return <button className={cn("rounded-md font-medium", variantClasses[variant], ...)} {...props} />;
};
export default Button;
```

- Function components with `React.FC`. Default export.
- Variants are lookup objects, not switch statements.
- `cn(...)` from `src/utils/classnames.ts` for conditional classes — don't introduce `clsx`.
- Component props extend the relevant DOM `*HTMLAttributes` plus `BaseComponentProps`.

### Tailwind Conventions

Theme tokens (`tailwind.config.js`) are the source of truth. Use semantic colors (`bg-primary`, `text-text-primary`, `bg-surface`) — never raw hex. Custom font sizes (`text-heading-1..6`, `text-body-lg/sm`, `text-caption`) wrap font-weight and line-height as a single token; prefer them over manual stacking.

Centralize / inline rule (from `Plans/SoCGuide.md`):

- **Centralize** — repeating variants, components like `Button`, `Card`, design-token-based classes.
- **Inline** — layout structure unique to a JSX block (`flex flex-col gap-4 p-4`).

### Async / Error Handling

- `async/await` throughout; `.then().catch()` only at top-level fire-and-forget call sites in the service worker (where `await` would block listener registration).
- Errors logged via `console.error("<contextual prefix>:", err)` and swallowed when the listener can recover. Top-level promise chains always have a `.catch` so the worker doesn't surface unhandled rejections.
- Defensive double-attempts for time-sensitive operations like `cacheWindowState` (first attempt + 100 ms retry) — pattern used because the worker may be torn down mid-operation.

### Imports

- Relative imports (`../utils`, `../../types/ui`) dominate. The `@` alias exists but is rarely used.
- Re-export from `index.ts` barrels (`src/types/index.ts`, `src/utils/index.ts`, `src/components/ui/index.ts`).
- Default browser API import: `import browser from "../utils/browserAPI"`.

---

## Build & Distribution

### Local

```bash
npm run dev      # webpack --watch, source maps on
npm run build    # production webpack + zip-extension
npm run lint     # eslint . --ext .ts,.tsx
```

`dist/` holds the unpacked extension (loadable via `chrome://extensions → Load unpacked`). `builds/` holds zips ready for store upload.

### Versioning

`scripts/tools/version-update.js <level>`:

- `0` — tag the current version only (no bump)
- `1` — patch (x.y.**z**)
- `2` — minor (x.**y**.0)
- `3` — major (**x**.0.0)

Levels 1-3 sync `package.json` and `public/manifest.json`, auto-commit (`Bump version to <v>`), then tag `v<version>`. Push the tag to fire the release pipeline.

### Release Pipeline (`.github/workflows/release.yml`)

Trigger: push of any `v*` tag.

Steps: checkout (LFS) → Node 18 → `npm ci` → `npm run build` → `softprops/action-gh-release@v1` publishes `builds/*.zip` as a public GH release with auto-generated notes. Chrome Web Store upload is **manual** — download the zip from the release and upload via the Web Store dashboard.

---

## Known Discrepancies (worth fixing later, not now)

These are real-but-deferred mismatches between docs / config / shipped behavior. Document them so a future task can decide whether to converge config or strip dead config:

1. **Debounce mismatch.** `DEFAULT_CONFIG.autosaveDebounce = 5000` (`src/types/storage.ts`), but `src/background/index.ts` uses a hardcoded `2000` in `debouncedSnapshotCreation`. Either wire the config through or drop the field.
2. **Snapshot count limit.** `Plans/MVPChecklist.md` specifies "5 auto-snapshots per window". Shipped `SnapshotMap` is one-per-window. The cap is meaningless as currently implemented.
3. **Auto-delete TTL.** Same source: a TTL config was planned. No TTL field exists in `OopsConfig` today.
4. **Style references.** `Plans/StyleDesignOverview.md` references `@headlessui/react` for modals; current `Modal.tsx` does not import it (custom implementation). Doc says one thing, code does another.
5. **Tailwind config typography.** Custom semantic font sizes (`heading-1..6`, `body-lg/sm`, `caption`) are defined but components mostly use plain Tailwind sizes (`text-sm`, `text-xs`). Either adopt the semantic scale or trim the unused tokens.

---

## Architecture Rules (must-follow)

1. **Don't import `chrome.*` directly** — go through `src/utils/browserAPI.ts` so polyfill + feature-detect stay consistent.
2. **Listeners register at top level of `background/index.ts`** — never inside conditional async wrappers, or events get lost on cold start.
3. **No DOM APIs in `background/`** — service worker only.
4. **No inline `<script>` or `eval`** — CSP forbids it. Anything dynamic ships as a separate `.js` file (see `middleware-tab.js`).
5. **Domain types live in `src/types/`** — never re-declare `WindowSnapshot`, `TabData`, `OopsConfig`, etc. in component files.
6. **Theme tokens, not hex values.** New colors go into `tailwind.config.js` first.
7. **`cn()` for conditional classes**, not `clsx` (not installed) and not string concatenation.
8. **Add `STORAGE_KEYS.*` for new persisted keys** — string literals scattered across files cause silent typos.
9. **`tabGroups` calls must guard on `supportsTabGroups`** — Firefox lacks the API.
10. **Default-export the primary symbol of a UI module** — that's the existing convention.
