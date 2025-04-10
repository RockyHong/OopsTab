# 📋 OopsTab - Minimum Viable Product (MVP) Checklist

_A structured implementation plan for Phase 2 of OopsTab_

---

## 🚀 Manual Save / Promote Snapshot

- [ ] Create "Save" button UI component for auto-saved snapshots
- [ ] Implement promotion logic to move snapshots to Saved Sessions list
- [ ] Add event handler for save button clicks
- [ ] Update storage schema to track saved vs. auto-saved status
- [ ] Implement visual differentiation between saved and auto-saved snapshots
- [ ] Test save functionality works properly across browser sessions

---

## 🏷️ Session Rename

- [ ] Implement editable name field in session card UI
- [ ] Create default naming scheme: `TopTabTitle - Timestamp`
- [ ] Add rename functionality with edit/save controls
- [ ] Update storage schema to include custom names
- [ ] Implement validation for empty/duplicate names
- [ ] Test that renamed sessions persist across browser restarts

---

## 🗑️ Entry Deletion

- [ ] Add delete buttons to both auto-saved and saved session lists
- [ ] Create confirmation modal component with Material UI or Headless UI
- [ ] Implement deletion logic for storage cleanup
- [ ] Add visual feedback for deletion process
- [ ] Implement keyboard shortcuts for delete confirmation (Enter/Escape)
- [ ] Test deletion works for both session types

---

## ⚙️ Basic Configurations

- [ ] Create settings page UI with React components
- [ ] Implement configuration options:
  - [ ] Autosave debounce interval (ms)
  - [ ] Maximum snapshots per window
  - [ ] Auto-delete TTL for old auto-saves
- [ ] Add storage mechanism for user preferences
- [ ] Create default configuration values
- [ ] Implement settings persistence across browser sessions
- [ ] Add form validation and sanitization for settings
- [ ] Test that changed settings affect system behavior correctly

---

## 🎨 UI Enhancements

- [ ] Implement relative time labels (e.g., "10 minutes ago")
- [ ] Add action icons using Heroicons
- [ ] Enhance snapshot card view:
  - [ ] Display top 2 tab titles
  - [ ] Show tab count badge
  - [ ] Add timestamp with relative formatting
- [ ] Implement responsive design for different viewport sizes
- [ ] Add hover states and visual feedback for interactive elements
- [ ] Implement consistent styling using Tailwind CSS utility classes
- [ ] Test UI renders correctly across Chrome/Edge browsers

---

## 💾 Storage Management

- [ ] Implement snapshot size tracking mechanism
- [ ] Create quota-aware storage limit policy
- [ ] Add enforcement of 5 auto-snapshots per window limit
- [ ] Implement automatic pruning of old snapshots
- [ ] Add storage usage indicators to the UI
- [ ] Create warning system for approaching storage limits
- [ ] Test storage management with large numbers of snapshots

---

## 🧪 Testing Milestones

- [ ] Verify manual save properly promotes snapshots to saved list
- [ ] Confirm session rename persists across browser restarts
- [ ] Test deletion confirmation works correctly
- [ ] Validate settings changes are applied immediately
- [ ] Verify UI enhancements render correctly across browsers
- [ ] Test storage management properly enforces limits
- [ ] Perform user flow testing with common scenarios

---

## 🏁 MVP Completion Criteria

- [ ] Users can manually save and promote auto-saved snapshots
- [ ] Sessions can be renamed with custom, meaningful names
- [ ] Entries can be deleted with confirmation
- [ ] Basic configuration options are available and persistent
- [ ] UI provides clear, actionable information about sessions
- [ ] Storage is properly managed within browser constraints
- [ ] All core functionality works reliably across supported browsers

---

_Note: This checklist focuses on the MVP scope as defined in the Development Plan. Features from Phase 3 like tagging, search, and cloud sync are intentionally excluded for the MVP phase._
