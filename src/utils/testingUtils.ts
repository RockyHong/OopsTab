/**
 * Testing Utilities for OopsTab
 * Provides helper functions for testing and debugging
 */

import { getAllSnapshots, getWindowIdMap } from ".";
import browser, { supportsTabGroups } from "./browserAPI";

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
      await browser.storage.local.remove(["oopsWindowIdMap", "oopsSnapshots"]);
      console.log("📢 All OopsTab data cleared from storage");
    } catch (err) {
      console.error("Error clearing data:", err);
    }
  }
};

/**
 * Get current storage usage
 * Note: This uses Chrome API if available, otherwise estimates
 */
export const getStorageUsage = async (): Promise<{ bytesInUse: number }> => {
  try {
    // Chrome-specific API
    if (typeof chrome !== "undefined" && chrome.storage?.local?.getBytesInUse) {
      return { bytesInUse: await chrome.storage.local.getBytesInUse(null) };
    }

    // For other browsers, get all data and calculate size from that
    const allData = await browser.storage.local.get(null);
    const jsonSize = JSON.stringify(allData).length;

    // Estimate: JSON string length is a reasonable approximation
    return { bytesInUse: jsonSize };
  } catch (error) {
    console.warn("Error getting storage usage:", error);
    return { bytesInUse: 0 };
  }
};

/**
 * Get approximate storage quota
 * Note: This is an approximate value as browsers don't expose exact quota
 */
export const getStorageQuota = async (): Promise<number> => {
  // Local storage has approximately 5MB limit in most browsers
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
    const newWindow = await browser.windows.create({
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
      const tab = await browser.tabs.create({
        windowId,
        url: testUrls[i + 1],
      });

      if (tab.id) {
        tabIds.push(tab.id);
      }
    }

    // Create tab groups if requested and API is available
    if (useGroups && supportsTabGroups && tabIds.length >= 4) {
      try {
        // Create first group with first 2 tabs
        // @ts-ignore - Browser may have inconsistent API shape
        const groupA = await browser.tabs.group({
          tabIds: tabIds.slice(0, 2),
          createProperties: { windowId },
        });

        // @ts-ignore - Browser may have inconsistent API shape
        await browser.tabGroups.update(groupA, {
          title: "Group A",
          color: "blue",
        });

        // Create second group with next 2 tabs
        // @ts-ignore - Browser may have inconsistent API shape
        const groupB = await browser.tabs.group({
          tabIds: tabIds.slice(2, 4),
          createProperties: { windowId },
        });

        // @ts-ignore - Browser may have inconsistent API shape
        await browser.tabGroups.update(groupB, {
          title: "Group B",
          color: "red",
        });
      } catch (err) {
        console.warn("Error creating tab groups:", err);
      }
    }

    console.log(
      `Created test window with ${tabIds.length} tabs${
        useGroups && supportsTabGroups ? " and groups" : ""
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
