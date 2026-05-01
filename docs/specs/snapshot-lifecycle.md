# Snapshot Lifecycle

How snapshots are created, debounced, merged, and finalized — from event firing to durable storage.

## Why It Exists

A snapshot must capture **what the user was doing**, not every keystroke. Naïvely snapshotting on every tab event would burn storage quota and produce noise. Naïvely snapshotting only on close would lose data on crash. OopsTab walks a middle path:

- **Debounced live snapshots** during normal browsing.
- **Aggressive caching** the moment a tab disappears (last-tab-closes-window scenario).
- **Final guaranteed snapshot** when the window is removed.
- **Similarity-based merging** to absorb near-duplicate snapshots from history-reopens or duplicate work.

## Triggers

Listeners registered at the top of `src/background/index.ts`:

| Event | Action |
|---|---|
| `windows.onCreated` | After reopen-detection / register: `debouncedSnapshotCreation(windowId)` |
| `tabs.onCreated` | `debouncedSnapshotCreation(tab.windowId)` |
| `tabs.onRemoved` | `cacheWindowState(windowId)` (with retry) **then** `debouncedSnapshotCreation` |
| `tabs.onUpdated` | Only when `status === "complete"` or `title` changed → debounced |
| `tabs.onAttached` / `onDetached` | Debounced for new + old window |
| `tabGroups.onUpdated` | (only if `supportsTabGroups`) Debounced |
| `windows.onRemoved` | After 200 ms settle → `createFinalWindowSnapshot` |

Every regular path funnels through `debouncedSnapshotCreation`, **2000 ms hardcoded debounce**.

> **Known discrepancy:** `OopsConfig.autosaveDebounce` defaults to 5000 ms but is unused — `src/background/index.ts` hardcodes 2000. See `docs/techstack.md` "Known Discrepancies".

## Snapshot Creation (`createWindowSnapshot`)

1. Resolve `oopsWindowId` for the chrome window. If missing → log + bail.
2. Query all tabs in the window.
3. Skip if tab count is zero, or if it's a single tab with no groups (low-information snapshot).
4. Collect tab-group metadata via `tabGroups.get` (only when `supportsTabGroups`).
5. Build `TabData[]` — for each tab, check if it's a middleware tab (`extractOriginalTabData`). If so, unwrap the original URL/title/favicon from query params instead of recording the middleware URL.
6. Construct `WindowSnapshot` — preserves `customName` and `isStarred` from any existing snapshot for this `oopsWindowId`.
7. Run `mergeSnapshots` (similarity ≥75% → fold into existing). If merge happens, also rewrite `oopsWindowIdMap` so the chrome window points at the surviving snapshot.
8. `saveAllSnapshots` (writes to `chrome.storage.local` + chunked sync if enabled) + update storage stats.
9. Cache the same data in `windowStateCache` keyed by `chrome.windowId` — gives `createFinalWindowSnapshot` a fallback when the window has already disappeared.

## Final Snapshot On Close (`createFinalWindowSnapshot`)

`windows.onRemoved` waits 200 ms (let any in-flight `cacheWindowState` finish) then runs the final-snapshot path. Differences from the live path:

- **Does not skip single-tab windows** — at close-time, even a single tab is worth preserving.
- **Falls back to `windowStateCache`** if `tabs.query` returns empty (because the window is already gone).
- **Re-registers the `oopsWindowId`** if the user previously deleted the snapshot via the UI but the window is still alive — `deletedWindowSnapshots` set tracks this case.

## Cache-On-Close (`cacheWindowState`)

Called from `tabs.onRemoved` with retry, **before** any debounce. Captures the window's full tab/group state in a 30-second-TTL in-memory `Map<chrome.windowId, WindowStateCache>`. Reason: when the user closes a window by closing its last tab, `tabs.onRemoved` fires before `windows.onRemoved`, but by the time the 200 ms `windows.onRemoved` settle elapses the tabs are unreachable. The cache holds the data long enough for `createFinalWindowSnapshot` to use it.

The double-attempt pattern (first call + 100 ms setTimeout retry) exists because the service worker may be torn down mid-call; the second attempt gives the worker another chance to complete the cache write.

## Similarity-Based Merging (`mergeSnapshots`, `deduplicateSnapshots`)

### Per-snapshot merge (≥75%)

Every `createWindowSnapshot` runs `mergeSnapshots(newSnapshot, oopsWindowId, allSnapshots)`. The function compares against every other snapshot:

- **URL match score** = `matches / min(urls1, urls2)` — weighted **0.7**.
- **Group similarity** = average of (group-title overlap) and (group-count similarity) — weighted **0.3**.
- Total threshold: **75%**.

If a similar snapshot exists, decide which to keep using priority order:

1. Starred wins.
2. Has-custom-name wins.
3. More tabs wins.
4. Newer timestamp wins.

The loser's `oopsWindowIdMap` entries get rewritten to point at the winner, so the live chrome window seamlessly inherits the surviving snapshot.

### Pairwise sweep (`deduplicateSnapshots`)

Runs on:
- Service worker startup (`initializeWindowTracking`).
- After reopen-detection successfully reassociates a window.

O(n²) pairwise comparison — acceptable because n is bounded by user behavior (typically <50 windows). Each merge updates the map and removes the loser. Returns merge count.

## Data Flow

```
event ─┬─→ cacheWindowState (tabs.onRemoved only)
       ├─→ debouncedSnapshotCreation (2s)
       │     └─→ createWindowSnapshot
       │           ├─→ mergeSnapshots (≥75%)
       │           └─→ saveAllSnapshots ──→ storage.local + chunked sync
       └─→ (windows.onRemoved + 200ms) → createFinalWindowSnapshot
                                            └─→ saveAllSnapshots
```

## Cross-Module Touchpoints

- **`utils/windowTracking.ts`** — provides `oopsWindowId` resolution and reopen-detection that this lifecycle relies on.
- **`utils/snapshotManager.ts`** — owns all the lifecycle logic.
- **`background/index.ts`** — registers triggers; the hardcoded 2000 ms debounce lives here, not in the manager.
- **`types/snapshot.ts`** — defines `WindowSnapshot`, `SnapshotMap`, `TabData`, `TabGroupData`.

## Design Decisions

- **One snapshot per `oopsWindowId`, not a history chain** — the original PoC plan called for an array of historical snapshots per window with a 5-cap. Shipped code collapsed to a single live snapshot. Simpler model, still solves the recovery problem; downside is that "snapshot from 3 hours ago" is unrecoverable.
- **2000 ms debounce hardcoded** — empirically tuned. Lower felt jittery during fast tab opens; higher missed real changes. The unused `OopsConfig.autosaveDebounce` field is dead config.
- **Skip single-tab snapshots in the live path** — single-tab windows are usually transient (someone clicked a link in a side panel). Snapshotting them causes UI noise. The final-on-close path captures them anyway.
- **75% similarity threshold for merge** — chosen so that two windows mid-research-rabbit-hole on the same topic merge, while two windows that happen to share a couple of tabs (Gmail, GitHub) stay distinct.
- **Middleware-tab unwrapping in capture phase** — without this, a snapshot of a freshly-restored window would record middleware URLs and the next restore would chain-wrap, eventually exceeding URL length limits.

## Edge Cases

- **Tab group with no tabs after close** — `tabGroups.get` may fail; the catch block warns but the snapshot proceeds without that group.
- **Window closed during debounce** — debounced timer fires after window is gone; `getOopsWindowId` returns null, snapshot bails. The final-snapshot path handles this case via the cache.
- **`saveAllSnapshots` mid-flight when service worker dies** — the local-storage write is synchronous on the chrome side, so partial writes are unlikely. Sync-storage chunked write may partial-fail; the next successful save overwrites.
- **Storage quota exceeded** — silent failure today. `checkStorageLimits` warns at 60/75/90% but doesn't block. Worth wiring into the UI as a hard stop.
