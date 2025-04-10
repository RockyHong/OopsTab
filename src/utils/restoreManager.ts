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

    // Create a new window with the first tab
    const firstTab = sortedTabs[0];

    // Include hostname in URL fragment to preserve info when discarded
    let firstTabUrl = firstTab.url;
    try {
      if (!firstTab.url.includes("#oopstab=")) {
        const urlObj = new URL(firstTab.url);
        const displayName = firstTab.title || urlObj.hostname;
        // Add a special fragment that the browser will show when tab is discarded
        firstTabUrl = `${firstTab.url}#oopstab=${encodeURIComponent(
          displayName
        )}`;
      }
    } catch (err) {
      console.warn(`Could not enhance URL for ${firstTab.url}:`, err);
    }

    const createdWindow = await browser.windows.create({
      url: firstTabUrl,
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

    // Create the rest of the tabs without loading content immediately
    for (let i = 1; i < sortedTabs.length; i++) {
      const tab = sortedTabs[i];

      // Include hostname in URL fragment to preserve info when discarded
      let enhancedUrl = tab.url;
      try {
        if (!tab.url.includes("#oopstab=")) {
          const urlObj = new URL(tab.url);
          const displayName = tab.title || urlObj.hostname;
          // Add a special fragment that the browser will show when tab is discarded
          enhancedUrl = `${tab.url}#oopstab=${encodeURIComponent(displayName)}`;
        }
      } catch (err) {
        console.warn(`Could not enhance URL for ${tab.url}:`, err);
      }

      const newTab = await browser.tabs.create({
        windowId: newWindowId,
        url: enhancedUrl,
        pinned: tab.pinned,
        index: tab.index,
        active: false,
      });

      // Store the new tab ID for group creation
      tab.id = newTab.id || 0;

      // Discard the tab to prevent loading until user activates it
      if (newTab.id) {
        try {
          await browser.tabs.discard(newTab.id);
        } catch (err) {
          console.warn(`Could not discard tab ${newTab.id}:`, err);
        }
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
