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
  checkForReopenedWindow,
  getConfig,
  getAllSnapshots,
  saveAllSnapshots,
} from "../utils";
import browser from "../utils/browserAPI";
import { STORAGE_KEYS } from "../types";

// Added cleanup function for deleted window tracking
const cleanupDeletedWindowTracking = async () => {
  try {
    // Reset deleted window tracking on startup
    resetDeletedWindowTracking();
  } catch (err) {
    console.error("Error resetting deleted window tracking:", err);
  }
};

// Initialize on startup
initializeWindowTracking()
  .then(() => {
    // Initialization complete
  })
  .catch((err) => console.error("Error initializing window tracking:", err));

// Cleanup deleted window tracking on startup
cleanupDeletedWindowTracking();

// Debounced snapshot creation to avoid too many snapshots
const debouncedSnapshotCreation = debounce((windowId: number | undefined) => {
  if (typeof windowId !== "number") return;

  createWindowSnapshot(windowId)
    .then((success) => {
      if (success) {
        // Snapshot created successfully
      }
    })
    .catch((err) =>
      console.error(`Error creating snapshot for window ${windowId}:`, err)
    );
}, 2000); // 2 second debounce

// Listen for extension icon clicks
browser.action.onClicked.addListener(() => {
  browser.tabs.create({ url: "options.html" });
});

// Listen for storage changes
browser.storage.onChanged.addListener(async (changes, areaName) => {
  try {
    // Handle sync changes
    const config = await getConfig();

    // Only process sync changes if sync is enabled and the changes are from sync storage
    if (config.syncEnabled && areaName === "sync") {
      // Check if the changes include our snapshot data (either direct or chunked)
      const hasSnapshotChanges =
        changes[STORAGE_KEYS.SNAPSHOTS_KEY] ||
        changes[`${STORAGE_KEYS.SNAPSHOTS_KEY}_chunks`] ||
        Object.keys(changes).some((key) =>
          key.startsWith(`${STORAGE_KEYS.SNAPSHOTS_KEY}_chunk_`)
        );

      if (hasSnapshotChanges) {
        // Snapshot changes detected

        // Get the latest local snapshots
        const localSnapshots = await getAllSnapshots();

        // If local has data, save it back to sync to ensure we don't lose local-only changes
        // This will trigger another sync event but won't cause an infinite loop
        // because we'll merge the data sensibly
        if (Object.keys(localSnapshots).length > 0) {
          await saveAllSnapshots(localSnapshots);
        }
      }
    }
  } catch (err) {
    console.error("Error handling storage changes:", err);
  }
});

// Listen for window creation to assign oopsWindowId
browser.windows.onCreated.addListener((window) => {
  if (window.id !== undefined) {
    const windowId = window.id; // Store in a const to fix type issue
    // First check if this is a reopened window from Chrome history
    checkForReopenedWindow(windowId)
      .then((isReopenedWindow) => {
        if (isReopenedWindow) {
          // Window was reopened from history

          // Create a snapshot to update with latest state
          debouncedSnapshotCreation(windowId);
        } else {
          // Regular new window flow
          registerWindow(windowId)
            .then((oopsWindowId) => {
              // Window registered with ID

              // Create initial snapshot for this window
              debouncedSnapshotCreation(windowId);
            })
            .catch((err) =>
              console.error(`Error registering window ${windowId}:`, err)
            );
        }
      })
      .catch((err) => {
        console.error(`Error checking for reopened window ${windowId}:`, err);
        // Fallback to normal registration if the check fails
        registerWindow(windowId)
          .then((oopsWindowId) => {
            // Fallback registration completed

            debouncedSnapshotCreation(windowId);
          })
          .catch((err) =>
            console.error(`Error registering window ${windowId}:`, err)
          );
      });
  }
});

// Cache the state of a window more aggressively with retries
const ensureWindowStateCached = async (windowId: number): Promise<void> => {
  // Begin caching window state

  try {
    // First try
    await cacheWindowState(windowId);

    // Force a second try with a slight delay to make absolutely sure
    setTimeout(async () => {
      try {
        await cacheWindowState(windowId);
        // Second cache attempt succeeded
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
        // Recovery cache attempt succeeded
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
  // Tab created

  debouncedSnapshotCreation(tab.windowId);
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Tab removed

  // Cache the window state in case this is the last tab and window is about to close
  // Use the aggressive caching function that includes retries
  ensureWindowStateCached(removeInfo.windowId);

  // Still trigger normal snapshot process
  debouncedSnapshotCreation(removeInfo.windowId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only trigger on complete load or title changes
  if (changeInfo.status === "complete" || changeInfo.title) {
    // Tab content or title updated

    debouncedSnapshotCreation(tab.windowId);
  }
});

// Listen for tabs being attached to a window (e.g., drag-and-drop)
browser.tabs.onAttached.addListener((tabId, attachInfo) => {
  // Tab attached to window

  debouncedSnapshotCreation(attachInfo.newWindowId);
});

// Listen for tabs being detached from a window (e.g., drag-and-drop)
browser.tabs.onDetached.addListener((tabId, detachInfo) => {
  // Tab detached from window

  debouncedSnapshotCreation(detachInfo.oldWindowId);
});

// Handle tab groups if supported
if (browser.tabGroups) {
  browser.tabGroups.onUpdated.addListener((tabGroup) => {
    // Tab group updated

    debouncedSnapshotCreation(tabGroup.windowId);
  });
}

// Handle window closure
browser.windows.onRemoved.addListener((windowId) => {
  // Window closed

  // Add a small delay to ensure any in-progress caching completes
  setTimeout(() => {
    // Using a custom try-catch to ensure we don't lose track
    // even if the window mapping was previously removed
    (async () => {
      try {
        // Create final snapshot for the closed window

        const result = await createFinalWindowSnapshot(windowId);
        if (result) {
          // Final snapshot created successfully
        } else {
          // Failed to create final snapshot, try alternative approach

          // Use the already imported window tracking functions
          // instead of dynamically importing them again
          const idMap = await getWindowIdMap();

          // If this window already has an ID, we can try to force a snapshot
          if (idMap[windowId]) {
            // Window has existing ID

            createFinalWindowSnapshot(windowId).then((success) => {
              // Attempted to create final snapshot with existing ID
            });
          } else {
            // Window has no ID, register it first

            // Register the window one last time
            const oopsWindowId = await registerWindow(windowId);

            createFinalWindowSnapshot(windowId).then((success) => {
              // Created final snapshot after last-minute registration
            });
          }
        }
      } catch (err) {
        console.error(`Error handling window closure for ${windowId}:`, err);
      }
    })();
  }, 200); // 200ms delay to ensure cache is ready
});
