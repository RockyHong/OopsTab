# 📋 OopsTab - Minimum Viable Product (MVP) Checklist

_A structured implementation plan for Phase 2 of OopsTab_

---

## 🚀 Manual Save / Promote Snapshot

- [x] Create "Save" button UI component for auto-saved snapshots
- [x] Implement promotion logic to move snapshots to Saved Sessions list
- [x] Add event handler for save button clicks
- [x] Update storage schema to track saved vs. auto-saved status
- [x] Implement visual differentiation between saved and auto-saved snapshots
- [ ] Test save functionality works properly across browser sessions

---

## 🏷️ Session Rename

- [x] Implement editable name field in session card UI
- [x] Create default naming scheme: `TopTabTitle - Timestamp`
- [x] Add rename functionality with edit/save controls
- [x] Update storage schema to include custom names
- [x] Implement validation for empty/duplicate names
- [ ] Test that renamed sessions persist across browser restarts

---

## 🗑️ Entry Deletion

- [x] Add delete buttons to both auto-saved and saved session lists
- [x] Create confirmation modal component with Material UI or Headless UI
- [x] Implement deletion logic for storage cleanup
- [x] Add visual feedback for deletion process
- [x] Implement keyboard shortcuts for delete confirmation (Enter/Escape)
- [ ] Test deletion works for both session types

---

## ⚙️ Basic Configurations

- [x] Create settings page UI with React components
- [x] Implement configuration options:
  - [x] Autosave debounce interval (ms)
  - [x] Maximum snapshots per window
  - [x] Auto-delete TTL for old auto-saves
- [x] Add storage mechanism for user preferences
- [x] Create default configuration values
- [x] Implement settings persistence across browser sessions
- [x] Add form validation and sanitization for settings
- [ ] Test that changed settings affect system behavior correctly

---

## 🎨 UI Enhancements

- [x] Implement relative time labels (e.g., "10 minutes ago")
- [x] Add action icons using Heroicons
- [x] Enhance snapshot card view:
  - [x] Display top 2 tab titles
  - [x] Show tab count badge
  - [x] Add timestamp with relative formatting
- [x] Implement responsive design for different viewport sizes
- [x] Add hover states and visual feedback for interactive elements
- [x] Implement consistent styling using Tailwind CSS utility classes
- [ ] Test UI renders correctly across Chrome/Edge browsers

---

## 💾 Storage Management

- [x] Implement snapshot size tracking mechanism
- [x] Create quota-aware storage limit policy
- [x] Add enforcement of 5 auto-snapshots per window limit
- [x] Implement automatic pruning of old snapshots
- [x] Add storage usage indicators to the UI
- [x] Create warning system for approaching storage limits
- [x] Test storage management with large numbers of snapshots

---

## 🧪 Testing Milestones

- [x] Verify manual save properly promotes snapshots to saved list
- [ ] Confirm session rename persists across browser restarts
- [x] Test deletion confirmation works correctly
- [x] Validate settings changes are applied immediately
- [ ] Verify UI enhancements render correctly across browsers
- [x] Test storage management properly enforces limits
- [ ] Perform user flow testing with common scenarios

---

## 🏁 MVP Completion Criteria

- [x] Users can manually save and promote auto-saved snapshots
- [x] Sessions can be renamed with custom, meaningful names
- [x] Entries can be deleted with confirmation
- [x] Basic configuration options are available and persistent
- [x] UI provides clear, actionable information about sessions
- [x] Storage is properly managed within browser constraints
- [ ] All core functionality works reliably across supported browsers

---

_Note: This checklist focuses on the MVP scope as defined in the Development Plan. Features from Phase 3 like tagging, search, and cloud sync are intentionally excluded for the MVP phase._
