/**
 * Background service worker for OopsTab
 * Manages window tracking and automatic snapshot creation
 */

import {
  initializeWindowTracking,
  registerWindow,
  createWindowSnapshot,
  deleteSnapshot,
  getOopsWindowId,
  debounce,
} from "../utils";

console.log("OopsTab background service worker initialized");

// Initialize on startup
initializeWindowTracking()
  .then(() => console.log("Window tracking initialized"))
  .catch((err) => console.error("Error initializing window tracking:", err));

// Debounced snapshot creation to avoid too many snapshots
const debouncedSnapshotCreation = debounce((windowId: number | undefined) => {
  if (typeof windowId !== "number") return;

  createWindowSnapshot(windowId)
    .then((success) => {
      if (success) {
        console.log(`Snapshot created for window ${windowId}`);
      }
    })
    .catch((err) =>
      console.error(`Error creating snapshot for window ${windowId}:`, err)
    );
}, 2000); // 2 second debounce

// Listen for extension icon clicks
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: "oopstab.html" });
});

// Listen for window creation to assign oopsWindowId
chrome.windows.onCreated.addListener((window) => {
  if (window.id !== undefined) {
    registerWindow(window.id)
      .then((oopsWindowId) => {
        console.log(
          `Registered window ${window.id} with oopsWindowId ${oopsWindowId}`
        );
        // Create initial snapshot for this window
        debouncedSnapshotCreation(window.id);
      })
      .catch((err) =>
        console.error(`Error registering window ${window.id}:`, err)
      );
  }
});

// Listen for tab events to trigger snapshots
chrome.tabs.onCreated.addListener((tab) => {
  console.log(`Tab created in window ${tab.windowId}`);
  debouncedSnapshotCreation(tab.windowId);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log(`Tab removed from window ${removeInfo.windowId}`);
  debouncedSnapshotCreation(removeInfo.windowId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only trigger on complete load or title changes
  if (changeInfo.status === "complete" || changeInfo.title) {
    console.log(`Tab updated in window ${tab.windowId}`);
    debouncedSnapshotCreation(tab.windowId);
  }
});

// Listen for tabs being attached to a window (e.g., drag-and-drop)
chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  console.log(`Tab ${tabId} attached to window ${attachInfo.newWindowId}`);
  debouncedSnapshotCreation(attachInfo.newWindowId);
});

// Listen for tabs being detached from a window (e.g., drag-and-drop)
chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
  console.log(`Tab ${tabId} detached from window ${detachInfo.oldWindowId}`);
  debouncedSnapshotCreation(detachInfo.oldWindowId);
});

// Handle tab groups if supported
if (chrome.tabGroups) {
  chrome.tabGroups.onUpdated.addListener((tabGroup) => {
    console.log(`Tab group updated in window ${tabGroup.windowId}`);
    debouncedSnapshotCreation(tabGroup.windowId);
  });
}

// Handle window closure
chrome.windows.onRemoved.addListener((windowId) => {
  console.log(`Window closed: ${windowId}`);
  // Create one last snapshot before the window is gone.
  // The createWindowSnapshot function itself will handle
  // whether to save, skip, or delete based on tab/group count.
  createWindowSnapshot(windowId)
    .then((success) => {
      // Logging is handled within createWindowSnapshot
      if (success) {
        console.log(
          `Final snapshot attempt processed for closed window ${windowId}`
        );
      }
    })
    .catch((err) =>
      console.error(
        `Error creating final snapshot for window ${windowId}:`,
        err
      )
    );
});
