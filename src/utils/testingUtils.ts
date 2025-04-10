/**
 * Testing Utilities for OopsTab
 * Provides helper functions for testing and debugging
 */

import { getAllSnapshots, getWindowIdMap } from ".";

/**
 * Log all data in storage for debugging purposes
 * Displays window ID mappings and snapshots
 */
export const logStorageState = async (): Promise<void> => {
  try {
    console.group("📊 OopsTab Storage State");

    // Log window ID map
    const windowIdMap = await getWindowIdMap();
    console.log("Window ID Map:", windowIdMap);

    // Count windows mapped
    const windowCount = Object.keys(windowIdMap).length;
    console.log(`${windowCount} window(s) currently mapped`);

    // Log snapshots
    const snapshots = await getAllSnapshots();
    console.log("All Snapshots:", snapshots);

    // Count snapshots
    let totalSnapshotCount = 0;
    snapshots.forEach((entry) => {
      totalSnapshotCount += entry.snapshots.length;
    });
    console.log(
      `${snapshots.length} window entries with ${totalSnapshotCount} total snapshots`
    );

    // Log storage usage
    const usage = await getStorageUsage();
    const bytesUsed = usage.bytesInUse;
    const quota = await getStorageQuota();
    const percentUsed = Math.round((bytesUsed / quota) * 100);

    console.log(
      `Storage: ${formatBytes(bytesUsed)} / ${formatBytes(
        quota
      )} (${percentUsed}%)`
    );

    console.groupEnd();
  } catch (err) {
    console.error("Error logging storage state:", err);
  }
};

/**
 * Clear all OopsTab data from storage
 * Useful for testing/resetting
 */
export const clearAllData = async (): Promise<void> => {
  if (confirm("Are you sure you want to clear all OopsTab data?")) {
    try {
      await chrome.storage.local.remove(["oopsWindowIdMap", "oopsSnapshots"]);
      console.log("📢 All OopsTab data cleared from storage");
    } catch (err) {
      console.error("Error clearing data:", err);
    }
  }
};

/**
 * Get current storage usage
 */
export const getStorageUsage = async (): Promise<{ bytesInUse: number }> => {
  return { bytesInUse: await chrome.storage.local.getBytesInUse(null) };
};

/**
 * Get approximate Chrome storage quota
 * Note: This is an approximate value as Chrome doesn't expose exact quota
 */
export const getStorageQuota = async (): Promise<number> => {
  // Chrome local storage has approximately 5MB limit
  return 5 * 1024 * 1024;
};

/**
 * Format bytes to human-readable format
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Create a test window with multiple tabs for testing
 * @param tabCount Number of tabs to create
 * @param useGroups Whether to create tab groups
 */
export const createTestWindow = async (
  tabCount: number = 5,
  useGroups: boolean = true
): Promise<number | null> => {
  try {
    // URLs for test tabs
    const testUrls = [
      "https://www.google.com",
      "https://www.github.com",
      "https://www.stackoverflow.com",
      "https://www.mozilla.org",
      "https://developer.chrome.com",
      "https://www.wikipedia.org",
      "https://www.reddit.com",
      "https://www.youtube.com",
    ];

    // Create a new window with the first tab
    const newWindow = await chrome.windows.create({
      url: testUrls[0],
      focused: true,
    });

    if (!newWindow || !newWindow.id) {
      throw new Error("Failed to create test window");
    }

    const windowId = newWindow.id;

    // Create remaining tabs (clamp to available URLs)
    const remainingTabs = Math.min(tabCount - 1, testUrls.length - 1);
    const tabIds: number[] = [];

    if (newWindow.tabs && newWindow.tabs[0] && newWindow.tabs[0].id) {
      tabIds.push(newWindow.tabs[0].id);
    }

    for (let i = 0; i < remainingTabs; i++) {
      const tab = await chrome.tabs.create({
        windowId,
        url: testUrls[i + 1],
      });

      if (tab.id) {
        tabIds.push(tab.id);
      }
    }

    // Create tab groups if requested and API is available
    if (useGroups && chrome.tabGroups && tabIds.length >= 4) {
      // Create first group with first 2 tabs
      const groupA = await chrome.tabs.group({
        tabIds: tabIds.slice(0, 2),
        createProperties: { windowId },
      });

      await chrome.tabGroups.update(groupA, {
        title: "Group A",
        color: "blue",
      });

      // Create second group with next 2 tabs
      const groupB = await chrome.tabs.group({
        tabIds: tabIds.slice(2, 4),
        createProperties: { windowId },
      });

      await chrome.tabGroups.update(groupB, {
        title: "Group B",
        color: "red",
      });
    }

    console.log(
      `Created test window with ${tabIds.length} tabs${
        useGroups ? " and groups" : ""
      }`
    );
    return windowId;
  } catch (err) {
    console.error("Error creating test window:", err);
    return null;
  }
};

/**
 * Add console debug actions to window for easy testing
 */
export const setupDebugActions = (): void => {
  // @ts-ignore
  window.oopsTab = window.oopsTab || {};
  // @ts-ignore
  window.oopsTab.debug = {
    logStorage: logStorageState,
    clearData: clearAllData,
    createTestWindow,
  };

  console.log("🔍 OopsTab debug functions available on window.oopsTab.debug:");
  console.log("   - logStorage() - Log current storage state");
  console.log("   - clearData() - Clear all extension data");
  console.log(
    "   - createTestWindow(tabCount, useGroups) - Create test window"
  );
};
