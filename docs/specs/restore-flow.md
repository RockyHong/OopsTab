# Restore Flow

How a snapshot becomes a real browser window again — focus, recreate, lazy-load, regroup.

## Why It Exists

The whole point of OopsTab is to make a closed window's state recoverable. Restore must be:

- **Fast** — the user clicked Restore, they want to see the window now.
- **Network-friendly** — opening 50 tabs at once would melt their connection. The middleware-tab indirection defers loads until tabs are activated.
- **Faithful to the original** — pinned state, tab order, and tab groups (where supported) round-trip.
- **Idempotent on already-open windows** — clicking Restore on a window that's still open just focuses it.

## Two Paths

### A. Window Already Open → Focus

`findOpenWindow(oopsWindowId)` looks up the chrome window via `findWindowByOopsId`, which iterates `oopsWindowIdMap` and verifies the window still exists with `browser.windows.get`. If it does:

```
browser.windows.update(windowId, { focused: true })
```

Done. No tab recreation, no group setup. This path also handles the case where the user closed and immediately reopened the management page — they expect their already-open windows to surface, not duplicate.

### B. Window Closed → Recreate

`createWindowFromSnapshot(snapshot)`:

1. **Filter** — keep only tabs whose URL starts with `http` (drop `chrome://`, `file://`, etc., which Chrome refuses to open programmatically).
2. **Sort by `index`** — preserve the original tab order.
3. **First tab as window seed** — `browser.windows.create({ url: middlewareUrl(firstTab), focused: true })`. The new window comes up with one tab, which is a middleware page (see below).
4. **Apply pinned state** to the seed tab via `browser.tabs.update`.
5. **For each remaining tab** in order: `browser.tabs.create({ windowId, url: middlewareUrl(tab), pinned, index, active: false })`. Capture the new tab id back into `tab.id` for group setup.
6. **Recreate tab groups** (only if `supportsTabGroups && !isFirefox`) — for each group in the snapshot, gather the new tab ids, call `browser.tabs.group({ tabIds, createProperties: { windowId } })`, then `browser.tabGroups.update` to restore title/color/collapsed.
7. **Map the new chrome.windowId to the original oopsWindowId** via `oopsWindowIdMap` so the restored window inherits its identity (and any future snapshot will overwrite the existing one, not create a duplicate).

## Middleware-Tab Indirection

Every restored tab opens initially at:

```
chrome-extension://<id>/middleware-tab.html?url=<real>&title=<real>&favicon=<real>&tabdata=<json>
```

`middleware-tab.js` (separate file due to CSP — no inline scripts) sets `document.title` and the favicon `<link>` immediately, then registers a `visibilitychange` listener. The real URL only loads when the user activates the tab.

### Why

- A 50-tab restore would otherwise fire 50 page loads in parallel — destroys network and burns battery.
- The user can scan the restored window and pick the tab they want; the rest stay dormant.
- Title + favicon render immediately, so the tab strip looks correct on day one.

### The Round-Trip Cost

Snapshot/capture code must **unwrap middleware URLs** when recording tabs:

- `extractOriginalTabData(tab)` parses `tabdata` JSON or falls back to individual params.
- Used by `cacheWindowState` and `createWindowSnapshot` so a snapshot of a half-restored window doesn't record middleware URLs.
- Without this, a sequence of `restore → snapshot → restore` would chain-wrap the URL, eventually breaking.

## Tab Group Edge Cases

- **Firefox** — no `tabGroups` API. Snapshot still records groups, restore silently skips group recreation. Tabs come back in order but ungrouped.
- **Group color invalid** — Chrome returns the closest match; no failure.
- **Group has zero http(s) tabs after filter** — group is skipped.
- **`browser.tabs.group` returns boolean instead of id** in some shim versions — fallback uses the first tab id of the group as a stable handle. Acceptable because the next call is `tabGroups.update(groupId, …)` and the group id chrome assigned is what matters; if the call fails the group's title/color stay default.

## Identity Re-Association

The single most important step at the end of `restoreSession`:

```ts
const idMap = await getWindowIdMap();
idMap[newWindowId] = oopsWindowId;
await saveWindowIdMap(idMap);
```

Without this, the new chrome window would register as a brand-new identity on the next `windows.onCreated` (which fires before `restoreSession` returns), allocate a fresh UUID, and create a duplicate snapshot. The `windows.onCreated` listener does run `checkForReopenedWindow` first, which would catch this 70% of the time via URL match — but the explicit map write is faster and 100% reliable.

## Cross-Module Touchpoints

- **`utils/restoreManager.ts`** — owns the restore logic.
- **`utils/windowTracking.ts`** — `findWindowByOopsId`, `getWindowIdMap`, `saveWindowIdMap`.
- **`utils/snapshotManager.ts`** — `getWindowSnapshot` (read), `extractOriginalTabData` (the unwrap that this flow's middleware indirection depends on).
- **`src/middleware-tab.{html,js}`** — the deferred-load page that every restored tab opens initially.
- **`pages/oopstab/OopsTab.tsx`** — Restore button calls `restoreSession(oopsWindowId)`.

## Design Decisions

- **Middleware indirection over `browser.tabs.discard`** — `discard` requires the tab to load first, then suspend. Middleware page never loads the real URL until user activates. Net win on cold restore.
- **First-tab-via-`windows.create`, rest via `tabs.create`** — `windows.create({ url: [array] })` is supported but doesn't guarantee order on all chromium versions and doesn't let us set per-tab pinned state cleanly. Sequential creation is verbose but predictable.
- **Filter `http(s)` only** — chrome refuses to open `chrome://`, `file://`, `about:` programmatically. Trying anyway throws inside `tabs.create` and aborts the rest of the restore. Filter early.
- **Skip groups on Firefox without warning** — graceful degradation. The user would prefer ungrouped tabs over a failed restore.
- **Don't restore window dimensions** — `WindowMetrics` exists in types but isn't used by `createWindowFromSnapshot`. Reason: chrome positions the new window per its own logic (multi-monitor, screen change), and forcing snapshot dims often produces off-screen windows. Could revisit.

## Edge Cases

- **Snapshot has zero http(s) tabs after filter** — `createWindowFromSnapshot` returns null, restore fails silently from the user's perspective. UI should surface this; today the click does nothing visible.
- **`windows.create` returns no `tabs[0]`** — extremely rare chromium edge; restore returns null.
- **Tab attaches to a group that doesn't exist yet** — handled implicitly because tabs are created before `tabs.group` is called.
- **User closes the new window mid-restore** — pending `tabs.create` calls will throw. Errors are caught per-tab; partial restore leaves whatever tabs already opened. The new window mapping is still written (idempotent, no harm).
- **`oopsWindowId` of a window that already exists with the same id** — second restore call would re-focus instead of duplicate; correct behavior.
