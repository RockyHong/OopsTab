# 📋 OopsTab - Full Product (Phase 3) Checklist

_A structured implementation plan for Phase 3 of OopsTab_

---

## 🏷️ Session Tags / Labels

- [x] Design tag UI component with input and selection interface
- [x] Create tag storage schema in existing snapshot data structure
- [x] Implement tag creation, editing and deletion functionality
- [x] Add tag assignment to saved sessions
- [x] Create tag display component with appropriate styling
- [x] Implement tag color customization options
- [x] Add tag management in settings panel
- [x] Test tag persistence across browser sessions

---

## ⭐ Starred/Favorite Sessions

- [x] Add star/favorite toggle to session cards
- [x] Update storage schema to include favorite status flag
- [x] Implement visual indication for starred sessions
- [x] Create separate view/filter for favorite sessions
- [x] Add protection logic to prevent auto-deletion of starred sessions
- [x] Implement keyboard shortcut for quick starring (e.g., Alt+S)
- [x] Test starred sessions persist across browser restarts

---

## 🔍 Search, Sort, Filter

- [x] Create search bar component with real-time filtering
- [x] Implement session filtering by:
  - [x] Tags
  - [x] Tab count
  - [x] Session name
  - [x] Creation date range
- [x] Add sorting options:
  - [x] Most recent first
  - [x] Alphabetical (A-Z)
  - [x] Tab count (high to low)
  - [x] Custom order
- [x] Create filter persistence across app sessions
- [x] Implement filter combination logic (AND/OR operations)
- [x] Add visual indicators for active filters
- [x] Ensure search performance with large session counts

---

## ☁️ Cloud Sync (Optional)

- [ ] Design sync architecture with `chrome.storage.sync`
- [ ] Implement size-aware chunking for storage limits
- [ ] Create sync status indicators and controls
- [ ] Add manual import/export functionality for session JSON
- [ ] Implement conflict resolution strategy
- [ ] Create local fallback mechanism for sync failures
- [ ] Add sync frequency/trigger options in settings
- [ ] Add encryption option for sensitive session data
- [ ] Test sync behavior across multiple devices

---

## ⚙️ Enhanced User Preferences

- [ ] Expand settings UI with tabbed interface
- [ ] Implement autosave enable/disable toggle
- [ ] Add granular cleanup rule options:
  - [ ] Age-based pruning
  - [ ] Size-based pruning
  - [ ] Manual-only deletion option
- [ ] Create UI personalization options:
  - [ ] Light/dark mode toggle
  - [ ] Custom accent color selection
  - [ ] Density controls (compact/comfortable)
- [ ] Implement keyboard shortcut customization
- [ ] Add settings import/export functionality
- [ ] Implement settings validation and error handling
- [ ] Test settings persistence and application

---

## 🔄 Multi-Session Restore

- [x] Create multi-select UI for session cards
- [x] Implement batch restore functionality
- [x] Add target window selection dialog (new/existing)
- [x] Create progress indicator for multi-session restoration
- [x] Add option to combine multiple sessions into one window
- [x] Implement conflict resolution for duplicate tabs
- [x] Add keyboard shortcuts for multi-select (Shift+click, Ctrl+click)
- [x] Test batch restore with various session combinations

---

## ↩️ Undo Recent Delete

- [x] Design in-memory buffer for recently deleted sessions
- [x] Implement undo notification with action button
- [x] Create time-limited restore window (e.g., 30 seconds)
- [x] Add undo history panel in settings
- [x] Implement keyboard shortcut for undo (Ctrl+Z)
- [x] Create storage management for undo buffer
- [x] Test undo functionality across various deletion scenarios

---

## 🌐 Locale Formatting Support

- [x] Implement `Intl.DateTimeFormat` for all timestamps
- [x] Add locale detection and setting option
- [ ] Create translation framework for UI strings
- [ ] Add language selection in settings
- [x] Implement number formatting for tab counts and sizes
- [ ] Add RTL (right-to-left) support for appropriate languages
- [x] Test formatting with various locales and languages

---

## 🔄 Cross-Browser Compatibility

- [ ] Implement graceful fallback for unsupported tab group API in Firefox
- [ ] Add browser detection logic
- [ ] Create browser-specific manifest versions
- [ ] Use `webextension-polyfill` for API compatibility
- [ ] Test extension on Chrome, Firefox, and Edge
- [ ] Document browser-specific limitations
- [ ] Create browser-specific installation packages

---

## 🧪 Testing Milestones

- [x] Verify tag system properly categorizes and filters sessions
- [x] Confirm starred sessions are protected from auto-deletion
- [x] Test search and filter performs efficiently with 100+ sessions
- [ ] Validate cloud sync works across multiple devices
- [ ] Verify enhanced preferences properly affect system behavior
- [x] Test multi-session restore accurately recreates session state
- [x] Confirm undo functionality reliably recovers deleted sessions
- [x] Verify locale formatting adapts to user's system settings
- [ ] Test extension on all supported browsers

---

## 🏁 Phase 3 Completion Criteria

- [x] Users can categorize sessions with custom tags
- [x] Important sessions can be starred for protection and quick access
- [x] Sessions can be effectively searched, sorted, and filtered
- [ ] Session data can be synced across devices (optional)
- [ ] Users have comprehensive control over app behavior and appearance
- [x] Multiple sessions can be restored simultaneously
- [x] Recently deleted sessions can be recovered with undo
- [x] The app respects and adapts to user's locale settings
- [ ] Extension works across all supported browsers with appropriate fallbacks

---

_Note: This checklist represents the full product phase as defined in the Development Plan. Priorities may be adjusted based on user feedback from the MVP phase._
