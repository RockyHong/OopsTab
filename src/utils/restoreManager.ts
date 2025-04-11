/**
 * Restoration Manager Utilities for OopsTab
 * Handles restoring window sessions from snapshots
 */

import { WindowSnapshot } from "./snapshotManager";
import {
  findWindowByOopsId,
  getWindowIdMap,
  saveWindowIdMap,
} from "./windowTracking";
import browser, { isFirefox, supportsTabGroups } from "./browserAPI";

/**
 * Check if a window with the given oopsWindowId is currently open
 * @param oopsWindowId The oopsWindowId to check for
 * @returns Promise resolving to the window ID if found, null otherwise
 */
export const findOpenWindow = async (
  oopsWindowId: string
): Promise<number | null> => {
  return findWindowByOopsId(oopsWindowId);
};

/**
 * Focus an existing window
 * @param windowId The window ID to focus
 * @returns Promise resolving to true if successful
 */
export const focusWindow = async (windowId: number): Promise<boolean> => {
  try {
    await browser.windows.update(windowId, { focused: true });
    console.log(`Focused window ${windowId}`);
    return true;
  } catch (err) {
    console.error(`Error focusing window ${windowId}:`, err);
    return false;
  }
};

/**
 * Create and populate a new window based on a snapshot
 * @param snapshot The window snapshot to restore
 * @returns Promise resolving to the new window ID if successful, null otherwise
 */
export const createWindowFromSnapshot = async (
  snapshot: WindowSnapshot
): Promise<number | null> => {
  try {
    // Filter out any tabs that don't have valid URLs
    const validTabs = snapshot.tabs.filter(
      (tab) => tab.url && tab.url.startsWith("http")
    );

    if (validTabs.length === 0) {
      console.error("No valid tabs to restore");
      return null;
    }

    // Sort tabs by index to maintain original order
    const sortedTabs = [...validTabs].sort((a, b) => a.index - b.index);

    // Create a new window with the first tab (only one that loads immediately)
    const firstTab = sortedTabs[0];

    // Create the window with the first tab
    const createdWindow = await browser.windows.create({
      url: firstTab.url,
      focused: true,
    });

    if (
      !createdWindow ||
      !createdWindow.id ||
      !createdWindow.tabs ||
      !createdWindow.tabs[0]
    ) {
      console.error("Failed to create window");
      return null;
    }

    const newWindowId = createdWindow.id;
    const firstTabId = createdWindow.tabs[0].id;

    // Update the first tab's properties
    if (firstTabId) {
      await browser.tabs.update(firstTabId, { pinned: firstTab.pinned });
    }

    // Create map to store the relationship between tab positions and actual URLs
    const tabMapping: { id: number; targetUrl: string; index: number }[] = [];

    // First tab is already created
    if (firstTabId) {
      tabMapping.push({
        id: firstTabId,
        targetUrl: firstTab.url,
        index: firstTab.index,
      });
    }

    // Create the rest of the tabs as blank pages initially - this prevents loading
    for (let i = 1; i < sortedTabs.length; i++) {
      const tab = sortedTabs[i];

      const newTab = await browser.tabs.create({
        windowId: newWindowId,
        url: "about:blank", // Start with blank page to prevent loading
        pinned: tab.pinned,
        index: tab.index,
        active: false,
      });

      // Store the new tab ID and target URL for later loading
      if (newTab.id) {
        tab.id = newTab.id;
        tabMapping.push({
          id: newTab.id,
          targetUrl: tab.url,
          index: tab.index,
        });
      }
    }

    // Handle tab groups if the API is available
    // Some browsers like Firefox don't support tabGroups yet
    if (snapshot.groups.length > 0 && supportsTabGroups && !isFirefox) {
      for (const group of snapshot.groups) {
        // Find all tabs in this group
        const tabsInGroup = sortedTabs
          .filter((tab) => tab.groupId === group.id)
          .map((tab) => tab.id)
          .filter((id) => id > 0);

        if (tabsInGroup.length > 0) {
          try {
            // Use type assertion to handle inconsistent browser API shapes
            const groupIdResult = await (browser.tabs.group as any)({
              tabIds: tabsInGroup,
              createProperties: { windowId: newWindowId },
            });

            // Handle case where the API returns boolean or number
            const groupId =
              typeof groupIdResult === "number"
                ? groupIdResult
                : tabsInGroup[0]; // Fallback to first tab ID as group identifier

            // Only update if we have a valid numeric ID and the API exists
            if (
              typeof groupId === "number" &&
              browser.tabGroups &&
              typeof browser.tabGroups.update === "function"
            ) {
              await (browser.tabGroups.update as any)(groupId, {
                title: group.title,
                color: group.color,
                collapsed: group.collapsed,
              });
            }
          } catch (err) {
            console.warn("Error creating tab group:", err);
          }
        }
      }
    } else if (snapshot.groups.length > 0) {
      console.log("Tab groups not supported in this browser");
    }

    // Remove the first tab from the tabMapping since it was loaded directly
    const tabsToProcess = tabMapping.filter((tab) => tab.id !== firstTabId);

    // Process tabs in batches to load metadata but avoid high memory usage
    const batchSize = 5;

    // Function to process a batch of tabs - updating URLs and then discarding
    const processBatch = async (
      tabs: typeof tabMapping,
      startIndex: number
    ) => {
      const batchEnd = Math.min(startIndex + batchSize, tabs.length);
      const currentBatch = tabs.slice(startIndex, batchEnd);

      console.log(
        `Processing batch ${startIndex} to ${batchEnd - 1} of ${
          tabs.length
        } tabs`
      );

      // Update URLs for each tab in the batch
      for (const tab of currentBatch) {
        try {
          // Update the URL from blank to actual
          await browser.tabs.update(tab.id, { url: tab.targetUrl });
        } catch (err) {
          console.warn(`Could not update tab ${tab.id}:`, err);
        }
      }

      // Process each tab in the batch - wait a random time then discard
      for (const tab of currentBatch) {
        try {
          // Random delay between 300-700ms to let metadata load
          const discardDelay = 300 + Math.floor(Math.random() * 400);
          await new Promise((resolve) => setTimeout(resolve, discardDelay));

          await browser.tabs.discard(tab.id);
        } catch (err) {
          console.warn(`Could not discard tab ${tab.id}:`, err);
        }
      }

      // Process next batch if there are more tabs - fully sequential
      if (batchEnd < tabs.length) {
        // Process next batch immediately after this one completes
        await processBatch(tabs, batchEnd);
      }
    };

    // Start processing tabs in batches (skip the first tab which is already loaded)
    if (tabsToProcess.length > 0) {
      processBatch(tabsToProcess, 0);
    }

    console.log(`Restored window from snapshot with ${sortedTabs.length} tabs`);
    return newWindowId;
  } catch (err) {
    console.error("Error restoring window from snapshot:", err);
    return null;
  }
};

/**
 * Restore a window session from a snapshot
 * @param oopsWindowId The oopsWindowId of the window
 * @param snapshot The snapshot to restore
 * @returns Promise resolving to true if successful
 */
export const restoreSession = async (
  oopsWindowId: string,
  snapshot: WindowSnapshot
): Promise<boolean> => {
  try {
    // Check if snapshot has valid tabs
    if (!snapshot.tabs || snapshot.tabs.length === 0) {
      console.error("Cannot restore snapshot with no tabs");
      return false;
    }

    // Check if the window is already open
    const existingWindowId = await findOpenWindow(oopsWindowId);

    if (existingWindowId) {
      // Window is already open, just focus it
      return focusWindow(existingWindowId);
    } else {
      // Create a new window with the snapshot data
      const newWindowId = await createWindowFromSnapshot(snapshot);

      if (newWindowId) {
        // Associate the new window with the original oopsWindowId
        const idMap = await getWindowIdMap();
        idMap[newWindowId] = oopsWindowId;
        await saveWindowIdMap(idMap);
        console.log(
          `Associated new window ${newWindowId} with original oopsWindowId ${oopsWindowId}`
        );
        return true;
      }

      return false;
    }
  } catch (err) {
    console.error("Error restoring session:", err);
    return false;
  }
};
