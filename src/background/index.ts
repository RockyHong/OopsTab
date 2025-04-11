/**
 * Background service worker for OopsTab
 * Manages window tracking and automatic snapshot creation
 */

import {
  initializeWindowTracking,
  registerWindow,
  createWindowSnapshot,
  createFinalWindowSnapshot,
  debounce,
  getWindowIdMap,
  resetDeletedWindowTracking,
  cacheWindowState,
} from "../utils";
import browser from "../utils/browserAPI";

console.log("OopsTab background service worker initialized");

// Added cleanup function for deleted window tracking
const cleanupDeletedWindowTracking = async () => {
  try {
    // Reset deleted window tracking on startup
    resetDeletedWindowTracking();
    console.log("Deleted window tracking reset on startup");
  } catch (err) {
    console.error("Error resetting deleted window tracking:", err);
  }
};

// Initialize on startup
initializeWindowTracking()
  .then(() => console.log("Window tracking initialized"))
  .catch((err) => console.error("Error initializing window tracking:", err));

// Cleanup deleted window tracking on startup
cleanupDeletedWindowTracking();

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
browser.action.onClicked.addListener(() => {
  browser.tabs.create({ url: "oopstab.html" });
});

// Listen for window creation to assign oopsWindowId
browser.windows.onCreated.addListener((window) => {
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

// Cache the state of a window more aggressively with retries
const ensureWindowStateCached = async (windowId: number): Promise<void> => {
  console.log(
    `⚠️ Aggressively caching window ${windowId} state before possible closure`
  );
  try {
    // First try
    await cacheWindowState(windowId);

    // Force a second try with a slight delay to make absolutely sure
    setTimeout(async () => {
      try {
        await cacheWindowState(windowId);
        console.log(`✅ Second cache attempt for window ${windowId} completed`);
      } catch (err) {
        console.error(
          `Failed second cache attempt for window ${windowId}:`,
          err
        );
      }
    }, 100);
  } catch (err) {
    console.error(`Failed first cache attempt for window ${windowId}:`, err);

    // Still try again
    setTimeout(async () => {
      try {
        await cacheWindowState(windowId);
        console.log(
          `✅ Recovery cache attempt for window ${windowId} completed`
        );
      } catch (err) {
        console.error(
          `Failed recovery cache attempt for window ${windowId}:`,
          err
        );
      }
    }, 100);
  }
};

// Listen for tab events to trigger snapshots
browser.tabs.onCreated.addListener((tab) => {
  console.log(`Tab created in window ${tab.windowId}`);
  debouncedSnapshotCreation(tab.windowId);
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log(`Tab removed from window ${removeInfo.windowId}`);

  // Cache the window state in case this is the last tab and window is about to close
  // Use the aggressive caching function that includes retries
  ensureWindowStateCached(removeInfo.windowId);

  // Still trigger normal snapshot process
  debouncedSnapshotCreation(removeInfo.windowId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only trigger on complete load or title changes
  if (changeInfo.status === "complete" || changeInfo.title) {
    console.log(`Tab updated in window ${tab.windowId}`);
    debouncedSnapshotCreation(tab.windowId);
  }
});

// Listen for tabs being attached to a window (e.g., drag-and-drop)
browser.tabs.onAttached.addListener((tabId, attachInfo) => {
  console.log(`Tab ${tabId} attached to window ${attachInfo.newWindowId}`);
  debouncedSnapshotCreation(attachInfo.newWindowId);
});

// Listen for tabs being detached from a window (e.g., drag-and-drop)
browser.tabs.onDetached.addListener((tabId, detachInfo) => {
  console.log(`Tab ${tabId} detached from window ${detachInfo.oldWindowId}`);
  debouncedSnapshotCreation(detachInfo.oldWindowId);
});

// Handle tab groups if supported
if (browser.tabGroups) {
  browser.tabGroups.onUpdated.addListener((tabGroup) => {
    console.log(`Tab group updated in window ${tabGroup.windowId}`);
    debouncedSnapshotCreation(tabGroup.windowId);
  });
}

// Handle window closure
browser.windows.onRemoved.addListener((windowId) => {
  console.log(`Window closed: ${windowId}`);

  // Add a small delay to ensure any in-progress caching completes
  setTimeout(() => {
    // Using a custom try-catch to ensure we don't lose track
    // even if the window mapping was previously removed
    (async () => {
      try {
        console.log(
          `🔍 Attempting final snapshot for window ${windowId} after delay`
        );
        const result = await createFinalWindowSnapshot(windowId);
        if (result) {
          console.log(`Final snapshot created for closed window ${windowId}`);
        } else {
          console.log(
            `No snapshot was created for closed window ${windowId}, attempting recovery...`
          );
          // Use the already imported window tracking functions
          // instead of dynamically importing them again
          const idMap = await getWindowIdMap();

          // If this window already has an ID, we can try to force a snapshot
          if (idMap[windowId]) {
            console.log(
              `Found existing oopsWindowId for window ${windowId}, attempting direct snapshot`
            );
            createFinalWindowSnapshot(windowId).then((success) =>
              console.log(
                `Recovery snapshot ${success ? "succeeded" : "failed"}`
              )
            );
          } else {
            console.log(
              `No existing mapping for window ${windowId}, attempting to register and snapshot`
            );
            // Register the window one last time
            const oopsWindowId = await registerWindow(windowId);
            console.log(
              `Emergency registration of window ${windowId} with ID ${oopsWindowId}`
            );
            createFinalWindowSnapshot(windowId).then((success) =>
              console.log(
                `Emergency snapshot ${success ? "succeeded" : "failed"}`
              )
            );
          }
        }
      } catch (err) {
        console.error(`Error handling window closure for ${windowId}:`, err);
      }
    })();
  }, 200); // 200ms delay to ensure cache is ready
});
