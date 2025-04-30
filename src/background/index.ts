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

// Add listener for new tab page override
const setupNewTabListener = async () => {
  try {
    // Check if OopsTab is set as homepage
    const result = await browser.storage.local.get(["oopsTabIsHomepage"]);
    const isHomepage = !!result.oopsTabIsHomepage;

    if (isHomepage) {
      // Register the listener if set as homepage
      addNewTabListener();

      // Also check any existing new tab pages that might be open
      checkExistingTabs();
    }
  } catch (err) {
    console.error("Error setting up new tab listener:", err);
  }
};

// Function to check existing tabs when the extension starts
const checkExistingTabs = async () => {
  try {
    // Get all tabs in all windows
    const allTabs = await browser.tabs.query({});

    // Check each tab and redirect if it's a new tab page
    for (const tab of allTabs) {
      if (
        tab.url === "chrome://newtab/" ||
        tab.url === "about:newtab" ||
        tab.pendingUrl === "chrome://newtab/" ||
        tab.pendingUrl === "about:newtab"
      ) {
        if (tab.id) {
          browser.tabs.update(tab.id, { url: "options.html" });
        }
      }
    }
  } catch (err) {
    console.error("Error checking existing tabs:", err);
  }
};

// Function to add new tab listener
const addNewTabListener = () => {
  browser.tabs.onCreated.addListener(handleNewTab);

  // Also listen for new windows being created
  browser.windows.onCreated.addListener(handleNewWindow);
};

// Function to remove new tab listener
const removeNewTabListener = () => {
  browser.tabs.onCreated.removeListener(handleNewTab);

  // Remove window listener as well
  browser.windows.onCreated.removeListener(handleNewWindow);
};

// Handle new tab creation for homepage override
const handleNewTab = (tab: any) => {
  // Check if this is a new tab page
  if (
    tab.url === "chrome://newtab/" ||
    tab.url === "about:newtab" ||
    tab.pendingUrl === "chrome://newtab/" ||
    tab.pendingUrl === "about:newtab"
  ) {
    // Update the tab to show our options page instead
    if (tab.id) {
      browser.tabs.update(tab.id, { url: "options.html" });
    }
  }
};

// Handle new window creation for homepage override
const handleNewWindow = async (window: any) => {
  try {
    // Check if OopsTab is set as homepage
    const result = await browser.storage.local.get(["oopsTabIsHomepage"]);
    const isHomepage = !!result.oopsTabIsHomepage;

    if (!isHomepage || !window.id) return;

    // Short delay to ensure the window's first tab is fully loaded
    setTimeout(async () => {
      // Get all tabs in the newly created window
      const tabs = await browser.tabs.query({ windowId: window.id });

      // If there's only one tab and it's a new tab page, redirect it
      if (tabs.length === 1) {
        const tab = tabs[0];
        if (
          tab.url === "chrome://newtab/" ||
          tab.url === "about:newtab" ||
          tab.pendingUrl === "chrome://newtab/" ||
          tab.pendingUrl === "about:newtab"
        ) {
          if (tab.id) {
            browser.tabs.update(tab.id, { url: "options.html" });
          }
        }
      }
    }, 100);
  } catch (err) {
    console.error("Error handling new window:", err);
  }
};

// Listen for changes to the homepage setting
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.oopsTabIsHomepage) {
    if (changes.oopsTabIsHomepage.newValue) {
      // Add listener when set as homepage
      addNewTabListener();
    } else {
      // Remove listener when unset
      removeNewTabListener();
    }
  }
});

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

// Call setup on startup
setupNewTabListener();
