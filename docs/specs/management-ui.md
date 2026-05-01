# Management UI

The user-facing surface of OopsTab — `options.html` mounted as a React app with HashRouter, plus the homepage-override behavior that makes it the new-tab landing page.

## Why It Exists

OopsTab is a **page-not-popup** extension. Snapshot lists, restore actions, settings, and debug tooling all need real estate that a 320-pixel-wide popup can't deliver. So the management UI lives in a full-tab page (`options.html`), opened via the extension icon click or the optional homepage override.

## Entry Point

`manifest.json` declares:

```jsonc
"options_ui": {
  "page": "options.html",
  "open_in_tab": true
}
```

The extension icon click opens the same page:

```ts
browser.action.onClicked.addListener(() => {
  browser.tabs.create({ url: "options.html" });
});
```

(That listener lives in `src/background/index.ts` because the action click event is only delivered to the background context.)

`public/options.html` boots `dist/options.js` (compiled from `src/options/index.tsx`), which mounts the `Options` component into `#root`.

## Routing Layout (HashRouter)

`Options.tsx` owns a HashRouter — necessary because `options.html` is a static page served from the extension's chrome-extension:// origin, where `BrowserRouter`'s pushState would 404 on reload.

| Route | Component | Purpose |
|---|---|---|
| `/` | `OopsTab` (`src/pages/oopstab/OopsTab.tsx`) | Main snapshot list — windows past and present, restore/star/rename/delete. |
| `/settings` | `SettingsPanel` (`src/options/SettingsPanel.tsx`) | Config form, storage stats, sync toggle, homepage toggle, export/import, delete all. |
| `/debug` | `DebugPanel` (`src/pages/oopstab/DebugPanel.tsx`) | **Dev-only** — gated by `process.env.NODE_ENV === "development"`. Tree-shaken from production via webpack DefinePlugin. |

The top of `Options.tsx` houses a sticky nav with three icons (Home / Settings / Help) plus an About modal triggered by the logo click.

## Snapshot List View (`OopsTab` Component)

Reads `getAllSnapshots()` on mount (and on `chrome.storage.onChanged`). Renders each entry as a card:

- **Header** — custom name (editable inline) or top-tab title fallback, with star toggle and timestamp.
- **Body** — top 2-3 tab titles, total tab count badge, group indicators.
- **Actions** — Restore, Rename, Delete (with confirmation modal).

Open windows are flagged visually so the user knows clicking Restore will focus rather than recreate.

Above the list: a storage-stats banner (`getStorageStats`) showing usage with color-coded warnings at 60/75/90% (`checkStorageLimits`).

### Inline Rename

Pencil icon flips the title into a controlled input. Enter saves via `renameSnapshot`, Escape cancels. Empty/whitespace input rolls back to default.

### Star Toggle

`StarIcon` (solid/outline based on state) calls `toggleSnapshotStar(oopsWindowId, !current)`. Starred snapshots are marked visually and protected from `cleanupSnapshots`.

### Delete Confirmation

`Modal` component opens with primary/danger buttons. Confirm calls `deleteSnapshot(oopsWindowId)`. Note: deleting only removes the snapshot — the live window's `oopsWindowIdMap` entry stays so the next snapshot rebuilds under the same identity (see `window-tracking.md`).

## Settings Panel

`SettingsPanel.tsx` reads `getConfig()`, `getStorageStats()`, `checkStorageLimits()` on mount. Sections:

| Section | Surface |
|---|---|
| **Auto-save** | `autosaveDebounce` slider (currently config-only — not wired to background; see `docs/techstack.md` discrepancies). |
| **Sync** | `syncEnabled` toggle. Enabling triggers a `saveAllSnapshots(getAllSnapshots())` to seed sync. |
| **Homepage override** | Toggle → writes `oopsTabIsHomepage` to `chrome.storage.local`. Background listens via `storage.onChanged` and adds/removes new-tab/new-window override listeners. |
| **Storage stats** | Bytes used / total / window count. Color-coded warning at thresholds. |
| **Export** | `exportSnapshots()` → blob → download as JSON. |
| **Import** | File input → `importSnapshots(text)` → success modal with imported count. |
| **Delete all** | `deleteAllSnapshots()` with double-confirmation modal. |

## Homepage Override Behavior

Background-side feature — UI just toggles the flag. When `oopsTabIsHomepage = true`:

1. Background registers `tabs.onCreated` and `windows.onCreated` listeners that detect new-tab pages (`chrome://newtab/`, `about:newtab`, plus `pendingUrl` variants).
2. Detected new-tabs get redirected via `tabs.update(id, { url: "options.html" })`.
3. On extension startup, `setupNewTabListener` checks the flag and registers listeners if needed; also sweeps existing tabs for new-tab pages and redirects them.
4. New-window detection waits 100 ms after `windows.onCreated` to give the first tab a chance to load before checking — single-tab new windows whose first tab is a new-tab page get redirected.

Toggling the flag off removes the listeners. State changes route through `chrome.storage.onChanged` so multiple OopsTab pages stay in sync.

## Debug Panel (Dev Only)

`Options.tsx` does:

```tsx
const DebugPanel = process.env.NODE_ENV === "development"
  ? require("../pages/oopstab/DebugPanel").default
  : () => null;
```

Webpack `DefinePlugin` substitutes the literal at build time. Production builds tree-shake the entire `DebugPanel.tsx` module. Dev builds expose:

- Direct snapshot inspection (raw JSON view).
- Manual `deduplicateSnapshots` trigger.
- Manual `updateStorageStats` trigger.
- Test-window creation helpers (from `utils/testingUtils.ts`).

## Cross-Module Touchpoints

- **`pages/oopstab/index.{html,tsx}`** — separate webpack entry. Bundle exists but is currently mounted via `Options` instead of standalone. Kept as a build target for potential future dedicated tab UI.
- **`components/ui/`** — every UI primitive (Button, Card, Modal, Toggle, Spinner, ListItem, IconButton, Typography) used by both `OopsTab` and `SettingsPanel`. New primitives go here, not into the page modules.
- **`utils/snapshotManager.ts`** — UI calls `getAllSnapshots`, `deleteSnapshot`, `renameSnapshot`, `toggleSnapshotStar`, `cleanupSnapshots`, `exportSnapshots`, `importSnapshots`, `getConfig`, `saveConfig`, `getStorageStats`, `checkStorageLimits`.
- **`utils/restoreManager.ts`** — `restoreSession(oopsWindowId)` from the Restore button.
- **`background/index.ts`** — listens for the homepage flag, manages new-tab override listeners.

## Design Decisions

- **HashRouter over BrowserRouter** — required for chrome-extension:// pages where reloading any non-root path 404s without server-side routing.
- **Page-not-popup** — fits the data density. Popup variant was considered and dropped during PoC.
- **No dark mode (yet)** — `tailwind.config.js` has `darkMode: false`. Visual identity is the soft-green palette in `Plans/StyleDesignOverview.md`.
- **Storage-driven, not message-driven** — UI reads/writes `chrome.storage.local` directly via `utils/snapshotManager`. The `Message` discriminated union exists but is barely used today. Trade-off: less indirection, but storage-key typos aren't caught at a boundary.
- **DebugPanel via `require` at conditional eval** — using `import` would still bundle the module in production despite the dead branch (webpack tree-shaking + DefinePlugin handles `require` better here).
- **Homepage override is a non-default opt-in** — overriding the new-tab page is a meaningful change to the user's browser; surface it as a toggle, never auto-enable.

## Edge Cases

- **User has 100+ snapshots** — list is virtualized? **No, today.** Render cost grows linearly. Acceptable for current user counts; a virtual list is the future fix.
- **Two OopsTab management tabs open simultaneously** — both stay in sync via `chrome.storage.onChanged`. Edits in one reflect immediately in the other.
- **DebugPanel route hit in production** — `() => null` placeholder renders nothing. The route still resolves, just empty page. Acceptable; the `/debug` URL is not linked from production navigation.
- **Settings open when storage exceeds quota** — read paths still work (data is on disk); writes silently fail. The `delete all` button is the user's escape hatch — it always succeeds since it issues a delete, not a set.
- **Import with malformed JSON** — `importSnapshots` throws; UI catches and surfaces the error inline. No crash.
