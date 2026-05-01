# Window Tracking

How OopsTab assigns and preserves a stable identity for every browser window across browser restarts, history-reopens, and Chrome's own windowId churn.

## Why It Exists

`chrome.windowId` is **not stable** — it changes on browser restart, on "Reopen from history", and on any session-restore path. If snapshots were keyed by `chrome.windowId`, every restart would orphan every snapshot.

OopsTab introduces `oopsWindowId` — a UUID v4 generated on first-sight and persisted in `chrome.storage.local`. Every snapshot, every UI list entry, every restore action references this ID, not the volatile `chrome.windowId`.

## Core Behavior

### Mapping

Two-way map kept in `chrome.storage.local` under `oopsWindowIdMap`:

```
{ [chrome.windowId: number]: oopsWindowId: string }
```

Reverse lookups (`findWindowByOopsId`) iterate the map and verify the chrome window still exists via `browser.windows.get` — stale entries get pruned in the same pass.

### Lifecycle

| Event | Behavior |
|---|---|
| Service worker startup | `initializeWindowTracking()` calls `chrome.windows.getAll`, registers any unmapped window with a new UUID, runs `deduplicateSnapshots` to clean up post-restart drift. |
| `windows.onCreated` | First check `checkForReopenedWindow` (URL-similarity match). If no match, `registerWindow` allocates a new UUID. |
| `windows.onRemoved` | `oopsWindowIdMap` entry is **not removed** — the snapshot survives so the user can restore. |
| Snapshot deleted via UI | Window-id mapping is preserved (the live window keeps its identity even if the user wiped its snapshot). |

### Reopen Detection (≥70% URL Match)

When Chrome restores a window from "Recently closed" or "Reopen previous session", it allocates a fresh `chrome.windowId`. Without intervention, OopsTab would treat it as a brand-new window and lose continuity with the existing snapshot.

`checkForReopenedWindow(windowId)`:

1. Query the new window's tabs.
2. Compare each tab URL against every existing snapshot's tab URLs.
3. Compute match percentage = `matches / min(windowUrls, snapshotUrls)`.
4. **Threshold: 70%.** If best match ≥ 70% AND that `oopsWindowId` is **not already mapped to a still-alive chrome window**, reuse it.

The "still-alive" guard prevents stealing identity from a currently-open window that happens to share URLs (e.g., two windows researching the same topic). After successful reuse, `deduplicateSnapshots` runs to merge any duplicate created in the gap.

## Data Flow

```
windows.onCreated
  ├─→ checkForReopenedWindow ──[match ≥70%]──→ idMap[newWindowId] = matchedOopsId  → reuse snapshot
  │                            └─[no match]───→ registerWindow → new UUID
  └─→ debouncedSnapshotCreation
```

## Cross-Module Touchpoints

- **`background/index.ts`** — owns the `windows.onCreated` listener that triggers `checkForReopenedWindow` → `registerWindow`.
- **`utils/snapshotManager.ts`** — `deduplicateSnapshots` runs after reopen-detection rewires the map; otherwise reused IDs would coexist with new ones from before the merge.
- **`utils/restoreManager.ts`** — `restoreSession` writes a fresh entry to `oopsWindowIdMap` after creating a new window from a snapshot, so the new chrome window inherits the original `oopsWindowId`.

## Design Decisions

- **UUID v4 over incremental IDs** — avoids collisions across browser profiles + sync + import/export across machines.
- **70% similarity threshold for reopen** — chosen empirically; lower thresholds caused false-positive merges of unrelated windows that happened to share a popular URL (Google, GitHub home).
- **Identity persists through deletion** — deleting a snapshot via the UI does not remove the window's `oopsWindowId` mapping. Otherwise the live window would silently lose track of itself, and the next snapshot would create a brand-new identity, confusing the user.
- **Stale-entry pruning is lazy** — only happens on `findWindowByOopsId` lookups, not on a periodic sweep. The map stays small enough (one entry per open window) that scanning cost is negligible.

## Edge Cases

- **Chrome session restore restores N windows simultaneously** — startup `initializeWindowTracking` runs once, registers all of them. Reopen-detection only fires later on `windows.onCreated`, so the startup path **does not run match scoring** — restored windows get fresh UUIDs unless the user already had them mapped pre-shutdown (which they did, because `oopsWindowIdMap` is persisted).
- **Two windows with near-identical URL sets** — second window registers as new (the first one is still alive, blocks reuse). Snapshot merge later may collapse them via similarity sweep — design tradeoff, not a bug.
- **Window with one tab** — `createWindowSnapshot` skips snapshotting single-tab windows that have no tab groups. The `oopsWindowId` still gets registered; just no snapshot is written until the window has ≥2 tabs.
