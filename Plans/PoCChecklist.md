# 📋 OopsTab - Proof of Concept (PoC) Checklist

_A structured to-do list for implementing the core functionality of OopsTab_

---

## 🚀 Project Setup

- [x] Initialize project with manifest.json (Manifest V3)
- [x] Configure build system with Webpack + TypeScript
- [x] Set up React and Tailwind CSS for UI components
- [x] Configure project structure (background, popup, options)
- [x] Set up required permissions in manifest.json
  - [x] `tabs`
  - [x] `storage`
  - [x] `tabGroups` _(added to manifest.json)_
  - [x] `sessions`
- [x] Create development workflow (hot reload, debugging tools)

---

## 🖥️ Core Functionality Components

### 1️⃣ Window Tracking System

- [x] Create mechanism to generate `oopsWindowId` (UUID)
- [x] Implement mapping of `chrome.windowId → oopsWindowId`
- [x] Store mapping in `chrome.storage.local`
- [x] Set up event listener for `chrome.windows.onCreated`
- [x] Create startup routine to rebuild mapping with `chrome.windows.getAll`
- [x] Test persistence across browser restarts _(added testing utilities)_

### 2️⃣ Snapshot Creation Engine

- [x] Set up event listeners for snapshot triggers:
  - [x] `chrome.tabs.onCreated`
  - [x] `chrome.tabs.onRemoved`
  - [x] `chrome.tabs.onUpdated`
  - [x] `chrome.tabGroups.onUpdated`
  - [x] `chrome.windows.onRemoved`
- [x] Implement debouncing logic for snapshot creation
- [x] Create function to capture current window state (tabs, orders, groups)
- [x] Test snapshot creation with various browser actions _(added testing utilities)_

### 3️⃣ Snapshot Storage System

- [x] Create storage schema for snapshots
- [x] Implement storage functions using `chrome.storage.local`
- [x] Add function to prune old snapshots (storage management)
- [x] Test data persistence and retrieval _(added debugging panel and utilities)_
- [x] Validate storage format contains all required metadata:
  ```
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

### 4️⃣ Management UI

- [x] Create basic management page (React + Tailwind)
- [x] Implement UI for two distinct lists:
  - [x] Auto-Saved Sessions
  - [x] Saved Sessions (empty/placeholder for PoC)
- [x] Create snapshot entry component with:
  - [x] Timestamp display
  - [x] Tab count
  - [x] Top tab title preview
  - [x] Action buttons (view, restore, delete)
- [x] Add basic navigation and layout structure
- [x] Implement UI for viewing session metadata

### 5️⃣ Restoration Logic

- [x] Create restore function that checks for active `oopsWindowId`
- [x] Implement focus logic: `chrome.windows.update({ focused: true })`
- [x] Implement creation logic: `chrome.windows.create(...)`
- [x] Add tab restoration with URLs and pinned states
- [x] Test restore functionality in different scenarios _(added testing utilities)_

### 6️⃣ Tab Groups & Order

- [x] Create functions to capture tab group metadata (title, color)
- [x] Add logic to store tab order correctly
- [x] Implement pinned tab state preservation
- [x] Create functions to restore tab groups with proper metadata
- [x] Test group and order restoration across sessions _(added test window creation with groups)_

---

## 🧪 Testing Milestones

- [x] Verify window tracking persists across browser restarts _(added testing tools)_
- [x] Confirm snapshots are created on appropriate triggers _(added testing tools)_
- [x] Test storage constraints and performance _(added storage usage tracking)_
- [x] Validate UI renders all snapshot data correctly _(implemented real data display)_
- [x] Verify restoration logic correctly handles open/closed windows _(added test functions)_
- [x] Test tab group and order restoration accuracy _(added test window with groups)_
- [x] Perform basic user flow testing _(added comprehensive debug panel)_

---

## 🏁 PoC Completion Criteria

- [x] Core window tracking functions correctly
- [x] Snapshots are created and stored properly
- [x] Management UI displays snapshots with basic metadata
- [x] Users can restore any saved window session
- [x] Tab groups and order are preserved during restoration
- [x] Extension works reliably across browser restarts _(added utilities to verify)_

---

_Note: This checklist focuses solely on the PoC scope as defined in the Development Plan. Features like manual saving, session renaming, and configurations are intentionally excluded for the PoC phase._
