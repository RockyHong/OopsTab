# Snapshot Storage

Where snapshots live, how they're laid out, the optional sync path, and the export/import escape hatch.

## Why It Exists

OopsTab is privacy-friendly by default — no cloud, no account, no telemetry. Storage is local, fast, and observable. But users want their snapshots to survive a Chrome profile rebuild or a new machine, so an opt-in sync path and a manual export/import round out the model.

## Storage Backends

| Backend | When Used | Quota |
|---|---|---|
| `chrome.storage.local` | Always — primary. Read on every UI render, written on every snapshot. | ~5 MB default; queryable via `navigator.storage.estimate()`. |
| `chrome.storage.sync` | Only if `OopsConfig.syncEnabled` is true. Mirror of local data, chunked. | ~100 KB per item; ~8 KB per sync key — see chunking below. |

`chrome.storage.local` is the source of truth. Sync is best-effort — if it fails or partial-writes, local stays correct.

## Storage Keys

All defined as constants in `src/types/storage.ts` (`STORAGE_KEYS`):

| Key | Type | Purpose |
|---|---|---|
| `oopsSnapshots` | `SnapshotMap` = `{ [oopsWindowId]: WindowSnapshot }` | All snapshots, one entry per logical window. |
| `oopsWindowIdMap` | `{ [chrome.windowId]: oopsWindowId }` | Live window → identity mapping. |
| `oopsConfig` | `OopsConfig` | `{ autosaveDebounce, syncEnabled }`. |
| `oopsStorageStats` | `StorageStats` | `{ totalBytes, usedBytes, lastUpdate, itemCounts.windows }`. Cached metric, refreshed on every `saveAllSnapshots`. |
| `oopsTabIsHomepage` | `boolean` | Loose flag — homepage-override toggle. Not in `STORAGE_KEYS` (legacy). |

> **Convention:** new persisted keys go in `STORAGE_KEYS` first, then code references `STORAGE_KEYS.X` — never raw string literals.

## Snapshot Schema

```ts
interface WindowSnapshot {
  timestamp: number;        // ms since epoch — last update
  tabs: TabData[];
  groups: TabGroupData[];
  customName?: string;      // user-supplied name
  isStarred?: boolean;      // protects from cleanup
}

interface TabData {
  id: number;               // chrome's tab id at capture time (not stable across restarts)
  url: string;              // unwrapped from middleware URL if applicable
  title: string;
  pinned: boolean;
  groupId: number;          // -1 = ungrouped
  index: number;            // tab order within window
  faviconUrl?: string;
}

interface TabGroupData {
  id: number;
  title?: string;
  color?: TabGroupColor;    // grey | blue | red | yellow | green | pink | purple | cyan | string
  collapsed?: boolean;
}
```

`TabData.id` is captured but **not authoritative** — at restore time the tab is recreated and gets a new id. The field exists for in-flight bookkeeping (associating new tab ids with their target group during restore).

## Sync Path (Chunked)

`chrome.storage.sync` enforces ~8 KB per item. Snapshot maps frequently exceed this. `saveAllSnapshotsToSync`:

1. Remove all old chunk keys (`oopsSnapshots_chunk_*`) — clean slate.
2. JSON-stringify the full map.
3. If serialized size > **80 KB** (`MAX_SYNC_CHUNK_SIZE` — staying safely under the 100 KB total per-area limit):
   - Slice into 80 KB string chunks: `oopsSnapshots_chunk_0`, `_chunk_1`, …
   - Write a count key: `oopsSnapshots_chunks` = N.
4. Else write `oopsSnapshots` directly + `oopsSnapshots_chunks` = 0.

`getAllSnapshotsFromSync` reverses this: read `oopsSnapshots_chunks`, then either fetch the direct value (count = 0) or fetch all numbered chunks and reassemble.

### Conflict Resolution

When `getAllSnapshots` runs with `syncEnabled`:

1. Read local snapshots.
2. Read sync snapshots (chunked or direct).
3. Merge: for each `oopsWindowId`, keep whichever has the **newer timestamp**.
4. Write merged result back to local.

Background also listens to `storage.onChanged` on the `sync` area. When sync data changes (another machine pushed an update), it triggers `getAllSnapshots → saveAllSnapshots` to reconcile and re-broadcast — the no-op write avoids infinite loops because merge is idempotent on identical timestamps.

## Storage Stats

`getStorageStats` / `updateStorageStats`:

- **Used bytes** = `JSON.stringify(snapshot).length` summed across all snapshots (rough but cheap).
- **Total bytes** = `navigator.storage.estimate().quota` if available, else `DEFAULT_STORAGE_QUOTA` (5 MB).
- **Item counts** = number of windows.

`checkStorageLimits` returns warning thresholds at **60% / 75% / 90%**. Warnings are surfaced in `SettingsPanel`; no hard stop on writes today.

## Export / Import (Manual Backup)

`exportSnapshots()` returns a pretty-printed JSON string of the full `SnapshotMap`. Settings UI saves it as a downloadable file.

`importSnapshots(jsonData)`:

1. Parse + validate (must be an object).
2. For each imported snapshot:
   - **Existing ID, identical content** (same tab count, URLs, order) → skip.
   - **Existing ID, different content** → write under new ID `imported-<timestamp>-<oldId>` with name prefix `Imported - <oldName>`.
   - **New ID** → insert as-is.
3. Save merged map.

Identity check uses `areSnapshotsIdentical`, which normalizes middleware-tab URLs before comparing — so importing a snapshot of restored tabs doesn't double-import them.

## Cleanup (`cleanupSnapshots`)

Optional manual cleanup, default `maxAge = 30 days` and `maxCount = 20`:

1. Split into starred + non-starred.
2. Sort non-starred by timestamp DESC.
3. Keep the newest `maxCount`.
4. Among those, drop any older than `maxAge`.
5. Always keep all starred snapshots (no cap, no age limit).

Triggered manually from the UI. No periodic auto-cleanup today (the original MVP plan called for an `autoDeleteTTL` config field; not implemented).

## Cross-Module Touchpoints

- **`utils/snapshotManager.ts`** — owns all storage I/O: get/save, sync chunking, stats, export/import, cleanup.
- **`background/index.ts`** — listens to `storage.onChanged` for sync reconciliation.
- **`pages/oopstab/OopsTab.tsx`** — reads `getAllSnapshots` for the list, calls `deleteSnapshot` / `renameSnapshot` / `toggleSnapshotStar`.
- **`options/SettingsPanel.tsx`** — owns sync toggle, export/import buttons, storage stats display, delete-all.

## Design Decisions

- **Local primary, sync secondary** — sync is opt-in and known-flaky. Treating sync as best-effort means the UI never blocks on a sync write; user sees no spinner waiting on Google's servers.
- **Chunk on serialized size, not snapshot count** — a single window with hundreds of tabs can blow the per-item quota. Slicing the JSON string is robust to any shape.
- **Newer-timestamp wins on conflict** — last-write-wins is naïve but predictable. Three-way merge across machines is wildly out of scope for a free Chrome extension.
- **Snapshot identity field (`oopsWindowId`) is also the storage key** — flat object, O(1) lookup, no separate index. Trade-off: enumerating all snapshots requires reading the whole map, but n is small.
- **Export format = bare `SnapshotMap`** — no wrapping envelope, no version header. If the schema ever evolves (e.g., adding tags), the import path will need a migration step. Ship-it-fast trade.
- **Stats are cached** — recomputing on every UI render would be O(n × averageSnapshotSize). The cache is updated only on `saveAllSnapshots`.

## Edge Cases

- **Sync quota exceeded mid-chunk-write** — partial write leaves stale chunk keys with the wrong count. Next successful save overwrites cleanly because step 1 wipes old chunks first.
- **Local quota exceeded** — silent failure inside `browser.storage.local.set`. `console.error` logs but UI doesn't surface. Worth fixing.
- **Imported file with corrupted middleware URL** — `getNormalizedUrl` falls back to the raw URL on parse failure. Imported snapshot may carry a malformed entry but won't crash the load path.
- **Two machines write to sync simultaneously** — last write wins at the sync layer. Each machine eventually sees the other's update via `storage.onChanged` and runs the merge — eventual consistency by timestamp.
