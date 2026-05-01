# Feature Specs

Source of truth for what OopsTab does and why. Each spec covers product-level behavior — intent, user flows, cross-module interactions, and design decisions.

**Permanent source of truth.** Superpowers specs (`docs/superpowers/specs/`) are work orders deleted after merge. These specs describe what exists and why — updated as features evolve.

**Product-level, code-light.** Implementation details and module internals live in the code. Specs focus on the "why" and the product logic that connects modules.

---

## Specs

| Spec | Covers |
|---|---|
| [window-tracking](window-tracking.md) | `oopsWindowId` UUID assignment, `oopsWindowIdMap` persistence, reopen detection (≥70% URL match), stale-entry pruning. |
| [snapshot-lifecycle](snapshot-lifecycle.md) | Snapshot triggers, 2 s debounce, similarity-based merge (≥75%), final-on-close path, cache-on-close fallback, deduplication sweep. |
| [snapshot-storage](snapshot-storage.md) | Storage backends (local + chunked sync), schema, storage keys, conflict resolution by timestamp, stats, export/import, cleanup policy. |
| [restore-flow](restore-flow.md) | Focus-or-recreate logic, middleware-tab indirection for lazy-load, tab group restoration, identity re-association after restore. |
| [management-ui](management-ui.md) | `options.html` shell with HashRouter, snapshot list view, settings panel, homepage override toggle, dev-only debug panel. |
