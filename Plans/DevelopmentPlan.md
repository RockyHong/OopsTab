# 💾 OopsTab – Technical Product Specification

_Chrome Extension for Window Snapshot and Session Recovery_

---

## 🧬 Core Product Concepts

### 🫰 1. Logical Windows (`oopsWindowId`)

- Each Chrome window is mapped to a **persistent unique ID** (`oopsWindowId`)
- This ID remains consistent even if the browser restarts or windowId changes

### 📸 2. Snapshots

- A snapshot = saved state of a window (tabs, URLs, order, groups)
- Snapshots are created automatically and/or manually
- Each snapshot is associated with its `oopsWindowId`

### 🗂 3. Session Types

- **Auto-Saved Windows**: Snapshots created automatically based on activity triggers
- **Saved Windows**: Snapshots manually saved by the user and protected from auto-deletion

---

## 💪 PHASE 1: Proof of Concept (PoC)

### 🌟 Goal

Prove core functionality: per-window tracking, snapshotting, restoring window sessions, and managing sessions in a simple UI.

### ✅ Scope

#### 1. **Window Tracking**

- On `chrome.windows.onCreated`, generate a `oopsWindowId` (UUID)
- Map `chrome.windowId → oopsWindowId` in memory and `chrome.storage.local`
- Rebuild mapping on startup with `chrome.windows.getAll`

#### 2. **Snapshot Creation**

- Triggered by:
  - `chrome.tabs.onCreated`, `.onRemoved`, `.onUpdated`
  - `chrome.tabGroups.onUpdated`
  - `chrome.windows.onRemoved`
- Debounce snapshot creation to reduce noise

#### 3. **Snapshot Storage**

- Stored in `chrome.storage.local`
- Contains:
  ```ts
  {
    oopsWindowId: string,
    snapshots: [
      {
        timestamp: number,
        tabs: [...],
        groups: [...],
        pinned: boolean[]
      }
    ]
  }
  ```

#### 4. **Custom Management Page**

- Two lists: Auto-Saved Sessions and Saved Sessions
- Entry actions:
  - View metadata (tab count, time)
  - Reopen (or focus if already open)
  - Delete

#### 5. **Restoration Logic**

- On "Reopen":
  - Check for active `oopsWindowId`
  - If found: `chrome.windows.update({ focused: true })`
  - Else: `chrome.windows.create(...)`

#### 6. **Tab Groups & Order**

- Store tab group metadata (title, color)
- Store and restore tab order and pinned state

#### ❌ Out of Scope

- Manual save/bookmarking
- Rename sessions
- Configurable behavior
- Cloud sync, tagging

---

## 🔹 PHASE 2: Minimum Viable Product (MVP)

### 🌟 Goal

Add essential user-facing features to minimize friction and support intentional session saving.

### ✅ Additions

#### 1. **Manual Save / Promote Snapshot**

- "Save" button promotes snapshot to Saved Sessions list

#### 2. **Session Rename**

- Users can rename saved sessions
- Default name: `TopTabTitle - Timestamp`

#### 3. **Entry Deletion**

- Delete from either list with modal confirmation

#### 4. **Basic Configurations**

- Autosave debounce interval
- Max snapshots per window
- Auto-delete old auto-saves (TTL)

#### 5. **UI Enhancements**

- Relative time labels
- Icons for actions
- Snapshot card view: top 2 tab titles, tab count, timestamp

#### 6. **Storage Management**

- Track snapshot size
- Enforce quota-aware storage limit policy
- Limit: 5 auto-snapshots per window

#### 7. **Permissions Required**

- `tabs`, `storage`, `sessions`, `tabGroups`

---

## 🌟 PHASE 3: Full Product

### 🌟 Goal

Deliver a polished, user-centric experience with customization, permanence, and power tools.

### ✅ Additions

#### 1. **Session Tags / Labels**

- Tag saved sessions (e.g., Work, Research)

#### 2. **Starred/Favorite Sessions**

- Persistent sessions protected from cleanup

#### 3. **Search, Sort, Filter**

- Filter by tag, tab count, name
- Sort by recent, alphabetical, etc.

#### 4. **Cloud Sync (Optional)**

- `chrome.storage.sync` integration (with local fallback)
- Manual import/export of session JSON

#### 5. **User Preferences Panel**

- Autosave toggle
- Cleanup rules
- UI personalization (light/dark)

#### 6. **Multi-Session Restore**

- Batch restore to new or existing windows

#### 7. **Undo Recent Delete**

- In-memory undo buffer or short-term session restore

#### 8. **Locale Formatting Support**

- Use `Intl.DateTimeFormat` for date/time labels

---

## 🔧 Cross-Browser Compatibility

### Core API Support

| Feature               | Supported Browsers                       |
| --------------------- | ---------------------------------------- |
| `windows`, `tabs` API | Chrome, Edge, Firefox                    |
| `storage.local`       | All                                      |
| `manifest_version: 3` | Chrome, Edge (stable), Firefox (partial) |
| Tab Groups            | Chrome, Edge only                        |

### Portability Notes

- Firefox: no `tabGroups` API, partial Manifest V3 support
- Use `webextension-polyfill` for API compatibility
- Graceful fallback: skip group restore if unsupported
- Storage limits vary slightly across browsers (5MB local is safe)

---

## 🔄 Technical Foundations

| Concept                | Stack / Strategy                       |
| ---------------------- | -------------------------------------- |
| UI Components          | React + Tailwind CSS + Heroicons       |
| Transitions/Dialogs    | @headlessui/react                      |
| Snapshot Triggers      | Event-based (tab/window/group changes) |
| Snapshot Deduplication | Hash or diff-based (optional)          |
| Restore Detection      | `oopsWindowId` → active `windowId`     |
| Storage                | `chrome.storage.local`                 |
| Build System           | Webpack + TypeScript                   |
| API Compat             | `webextension-polyfill`                |

---

## 🚀 Development Strategy

| Phase   | Goal                            | Deliverables                                      |
| ------- | ------------------------------- | ------------------------------------------------- |
| PoC     | Core snapshot/restore engine    | Background logic, custom page, open/focus control |
| MVP     | Essential user session features | Save/rename/delete + config + UI enhancements     |
| Product | Full polished app               | Tags, search, cloud sync, settings, i18n          |

---

OopsTab aims to make browser session recovery effortless, intentional, and cognitively aligned with how users work — across any supported browser.
