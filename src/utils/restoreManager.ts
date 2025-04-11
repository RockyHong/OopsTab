/**
 * Restoration Manager Utilities for OopsTab
 * Handles restoring window sessions from snapshots
 */

import { WindowSnapshot, getAllSnapshots } from "./snapshotManager";
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
 * Create a middleware URL that displays tab info without loading content
 * @param tab The tab data
 * @returns URL to the middleware page with tab info as parameters
 */
const createMiddlewareUrl = (tab: any): string => {
  const extensionUrl = browser.runtime.getURL("middleware-tab.html");

  // Ensure we have valid data to pass
  const tabTitle = tab.title || "";
  const tabUrl = tab.url || "";
  const tabFaviconUrl = tab.faviconUrl || "";

  // Create the params object
  const params = new URLSearchParams();
  params.set("url", tabUrl);
  params.set("title", tabTitle);

  // Only add favicon if available
  if (tabFaviconUrl) {
    params.set("favicon", tabFaviconUrl);
  }

  // Create and add the tabdata JSON for future snapshot use
  const tabData = JSON.stringify({
    url: tabUrl,
    title: tabTitle,
    faviconUrl: tabFaviconUrl,
  });
  params.set("tabdata", tabData);

  return `${extensionUrl}?${params.toString()}`;
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

    // Create a new window with the first tab as middleware page
    const firstTab = sortedTabs[0];
    const firstTabMiddlewareUrl = createMiddlewareUrl(firstTab);

    // Create the window with the first tab as middleware
    const createdWindow = await browser.windows.create({
      url: firstTabMiddlewareUrl,
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

    // Create the rest of the tabs using middleware pages
    for (let i = 1; i < sortedTabs.length; i++) {
      const tab = sortedTabs[i];
      const middlewareUrl = createMiddlewareUrl(tab);

      const newTab = await browser.tabs.create({
        windowId: newWindowId,
        url: middlewareUrl,
        pinned: tab.pinned,
        index: tab.index,
        active: false,
      });

      // Store the new tab ID for group creation
      if (newTab.id) {
        tab.id = newTab.id;
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

/**
 * Helper function to get a specific snapshot by oopsWindowId and timestamp
 * @param oopsWindowId The window ID
 * @param timestamp The snapshot timestamp
 * @returns Promise resolving to the snapshot or null if not found
 */
export const getSnapshot = async (
  oopsWindowId: string,
  timestamp: number
): Promise<WindowSnapshot | null> => {
  const entries = await getAllSnapshots();
  const entry = entries.find((entry) => entry.oopsWindowId === oopsWindowId);
  if (!entry) return null;

  const snapshot = entry.snapshots.find((s) => s.timestamp === timestamp);
  return snapshot || null;
};

/**
 * Restore multiple sessions
 * @param sessions Array of sessions to restore
 * @param combineIntoOneWindow Whether to combine all sessions into a single window
 * @returns Promise resolving to success status
 */
export const restoreMultipleSessions = async (
  sessions: { oopsWindowId: string; timestamp: number }[],
  combineIntoOneWindow: boolean = false
): Promise<boolean> => {
  try {
    if (!sessions.length) {
      console.error("No sessions provided to restore");
      return false;
    }

    if (combineIntoOneWindow) {
      // Collect all tabs and groups from all snapshots to create a single window
      const allTabs: chrome.tabs.CreateProperties[] = [];
      const allGroups: {
        tabIds: number[];
        groupConfig: chrome.tabGroups.UpdateProperties & {
          collapsed?: boolean;
        };
      }[] = [];

      // Load all snapshots
      for (const session of sessions) {
        const { oopsWindowId, timestamp } = session;
        const snapshot = await getSnapshot(oopsWindowId, timestamp);

        if (!snapshot) {
          console.error(
            `Could not find snapshot for window ${oopsWindowId}, timestamp ${timestamp}`
          );
          continue;
        }

        // Collect tabs and groups
        const { tabCreateProps, groupConfigs } = prepareRestoreData(snapshot);
        allTabs.push(...tabCreateProps);
        allGroups.push(...groupConfigs);
      }

      // Create single window with all tabs
      return await createWindowWithTabsAndGroups(allTabs, allGroups);
    } else {
      // Restore each session in its own window
      const results = await Promise.all(
        sessions.map(async (session) => {
          const snapshot = await getSnapshot(
            session.oopsWindowId,
            session.timestamp
          );
          if (!snapshot) {
            console.error(
              `Could not find snapshot for window ${session.oopsWindowId}, timestamp ${session.timestamp}`
            );
            return false;
          }
          return await restoreSession(session.oopsWindowId, snapshot);
        })
      );

      // If any session was successfully restored, consider the operation successful
      return results.some((result) => result);
    }
  } catch (error) {
    console.error("Error restoring multiple sessions:", error);
    return false;
  }
};

/**
 * Prepare restore data - extract tabs and groups from a snapshot
 * @param snapshot The snapshot to prepare restore data for
 * @returns Object with tabCreateProps and groupConfigs
 */
const prepareRestoreData = (
  snapshot: WindowSnapshot
): {
  tabCreateProps: chrome.tabs.CreateProperties[];
  groupConfigs: {
    tabIds: number[];
    groupConfig: chrome.tabGroups.UpdateProperties & { collapsed?: boolean };
  }[];
} => {
  // Sort tabs by index to preserve order
  const sortedTabs = [...snapshot.tabs].sort((a, b) => a.index - b.index);

  // Create tab properties for each tab
  const tabCreateProps: chrome.tabs.CreateProperties[] = sortedTabs.map(
    (tab) => ({
      url: tab.url,
      pinned: tab.pinned,
      // Store original groupId in openerTabId (we'll use this later to reconstruct groups)
      openerTabId:
        tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
          ? tab.groupId
          : undefined,
    })
  );

  // Prepare group configurations
  const groupConfigs: {
    tabIds: number[];
    groupConfig: chrome.tabGroups.UpdateProperties & { collapsed?: boolean };
  }[] = [];

  // Only add group configs if tab groups are supported
  if (supportsTabGroups && snapshot.groups && snapshot.groups.length > 0) {
    // Map from original group ID to group config
    const groupMap = new Map(
      snapshot.groups.map((group) => [
        group.id,
        {
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
        },
      ])
    );

    // Create group configs
    for (const [groupId, groupConfig] of groupMap.entries()) {
      if (groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) continue;

      // Find all tabs in this group
      const tabsInGroup = sortedTabs
        .filter((tab) => tab.groupId === groupId)
        .map((tab) => tab.index);

      if (tabsInGroup.length > 0) {
        groupConfigs.push({
          tabIds: tabsInGroup,
          groupConfig,
        });
      }
    }
  }

  return {
    tabCreateProps,
    groupConfigs,
  };
};

/**
 * Create a window with the given tabs and groups
 * @param tabCreateProps Properties for tabs to create
 * @param groupConfigs Configurations for tab groups
 * @returns Promise resolving to success status
 */
const createWindowWithTabsAndGroups = async (
  tabCreateProps: chrome.tabs.CreateProperties[],
  groupConfigs: {
    tabIds: number[];
    groupConfig: chrome.tabGroups.UpdateProperties & { collapsed?: boolean };
  }[]
): Promise<boolean> => {
  try {
    if (!tabCreateProps.length) {
      console.error("No tabs provided to create window");
      return false;
    }

    // Create a new window with the first tab
    const firstTab = tabCreateProps[0];
    const window = await browser.windows.create({
      url: firstTab.url,
      focused: true,
    });

    if (!window || !window.id) {
      console.error("Failed to create window");
      return false;
    }

    const windowId = window.id;

    // Get the first tab that was created with the window
    const firstCreatedTabId = window.tabs?.[0]?.id;

    if (!firstCreatedTabId) {
      console.error("Failed to get first tab ID");
      return false;
    }

    // If the first tab should be pinned, update it
    if (firstTab.pinned) {
      await browser.tabs.update(firstCreatedTabId, { pinned: true });
    }

    // Create the rest of the tabs
    const createdTabs = [];

    if (window.tabs && window.tabs.length > 0) {
      createdTabs.push({ id: window.tabs[0].id, index: 0 });
    }

    for (let i = 1; i < tabCreateProps.length; i++) {
      const tabProps = tabCreateProps[i];
      const tab = await browser.tabs.create({
        windowId,
        url: tabProps.url,
        pinned: tabProps.pinned,
        active: false,
      });

      if (tab && tab.id) {
        createdTabs.push({ id: tab.id, index: i });
      }
    }

    // Create tab groups if supported
    if (supportsTabGroups && groupConfigs.length > 0 && browser.tabs.group) {
      // Map from original tab index to new tab ID
      const tabIndexToIdMap = new Map(
        createdTabs.map((tab) => [tab.index, tab.id])
      );

      // Create each group
      for (const { tabIds, groupConfig } of groupConfigs) {
        // Map original tab indices to new tab IDs
        const newTabIds = tabIds
          .map((originalIndex) => tabIndexToIdMap.get(originalIndex))
          .filter((id): id is number => id !== undefined);

        if (newTabIds.length > 0) {
          try {
            // Create the group
            const groupId = await browser.tabs.group({
              tabIds: newTabIds,
              createProperties: { windowId },
            });

            // Update group properties
            if (groupId !== undefined) {
              await browser.tabGroups.update(groupId, {
                title: groupConfig.title,
                color: groupConfig.color,
              });

              // Handle collapsed state separately
              if (groupConfig.collapsed) {
                await browser.tabGroups.update(groupId, { collapsed: true });
              }
            }
          } catch (err) {
            console.error("Error creating tab group:", err);
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Error creating window with tabs and groups:", error);
    return false;
  }
};
