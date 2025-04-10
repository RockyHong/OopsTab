/**
 * Restoration Manager Utilities for OopsTab
 * Handles restoring window sessions from snapshots
 */

import { WindowSnapshot } from "./snapshotManager";
import { findWindowByOopsId } from "./windowTracking";

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
    await chrome.windows.update(windowId, { focused: true });
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
    const createdWindow = await chrome.windows.create({
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
      await chrome.tabs.update(firstTabId, { pinned: firstTab.pinned });
    }

    // Create the rest of the tabs
    for (let i = 1; i < sortedTabs.length; i++) {
      const tab = sortedTabs[i];
      const newTab = await chrome.tabs.create({
        windowId: newWindowId,
        url: tab.url,
        pinned: tab.pinned,
        index: tab.index,
      });

      // Store the new tab ID for group creation
      tab.id = newTab.id || 0;
    }

    // Handle tab groups if the API is available
    if (snapshot.groups.length > 0 && chrome.tabGroups) {
      for (const group of snapshot.groups) {
        // Find all tabs in this group
        const tabsInGroup = sortedTabs
          .filter((tab) => tab.groupId === group.id)
          .map((tab) => tab.id)
          .filter((id) => id > 0);

        if (tabsInGroup.length > 0) {
          try {
            // Create the group
            const groupId = await chrome.tabs.group({
              tabIds: tabsInGroup,
              createProperties: { windowId: newWindowId },
            });

            // Update group properties
            await chrome.tabGroups.update(groupId, {
              title: group.title,
              color: group.color as chrome.tabGroups.ColorEnum,
              collapsed: group.collapsed,
            });
          } catch (err) {
            console.warn("Error creating tab group:", err);
          }
        }
      }
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
    // Check if the window is already open
    const existingWindowId = await findOpenWindow(oopsWindowId);

    if (existingWindowId) {
      // Window is already open, just focus it
      return focusWindow(existingWindowId);
    } else {
      // Create a new window with the snapshot data
      const newWindowId = await createWindowFromSnapshot(snapshot);
      return newWindowId !== null;
    }
  } catch (err) {
    console.error("Error restoring session:", err);
    return false;
  }
};
