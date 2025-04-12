/**
 * Testing Utilities for OopsTab
 * Provides helper functions for testing and debugging
 */

import { getAllSnapshots, getWindowIdMap } from ".";
import browser, { supportsTabGroups } from "./browserAPI";
import { saveAllSnapshots, updateStorageStats } from "./snapshotManager";
import { WindowSnapshot, TabData, SnapshotMap } from "../types";

// Type declaration for window.oopsTab global
declare global {
  interface Window {
    oopsTab?: {
      debug?: {
        logStorage?: () => Promise<void>;
        clearData?: () => Promise<void>;
        createTestWindow?: (
          tabCount?: number,
          useGroups?: boolean
        ) => Promise<number | null>;
        createBulkTestSnapshots?: (
          count?: number,
          windowCount?: number,
          tabsPerSnapshot?: number
        ) => Promise<boolean>;
      };
    };
  }
}

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
    const totalSnapshotCount = Object.keys(snapshots).length;
    console.log(`${totalSnapshotCount} window snapshots stored`);

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
 * Note: This estimates storage usage based on data size
 */
export const getStorageUsage = async (): Promise<{ bytesInUse: number }> => {
  try {
    // Get all data and calculate size from JSON
    const allData = await browser.storage.local.get(null);
    const jsonSize = JSON.stringify(allData).length;

    // JSON string length is a reasonable approximation
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

    console.log(`Created test window with ${tabCount} tabs`);
    return windowId;
  } catch (err) {
    console.error("Error creating test window:", err);
    return null;
  }
};

/**
 * Set up debug actions on the global window object
 * This allows for debugging via the console
 */
export const setupDebugActions = (): void => {
  if (typeof window !== "undefined") {
    // Create debug namespace if it doesn't exist
    if (!window.oopsTab) {
      window.oopsTab = {};
    }

    if (!window.oopsTab.debug) {
      window.oopsTab.debug = {};
    }

    // Add debug functions
    window.oopsTab.debug.logStorage = logStorageState;
    window.oopsTab.debug.clearData = clearAllData;
    window.oopsTab.debug.createTestWindow = createTestWindow;
    window.oopsTab.debug.createBulkTestSnapshots = createBulkTestSnapshots;

    console.log(
      "OopsTab debug functions are available via window.oopsTab.debug"
    );
  }
};

/**
 * Create bulk test snapshots for stress testing
 * @param count Number of snapshots to create total
 * @param windowCount Number of windows to distribute snapshots across
 * @param tabsPerSnapshot Number of tabs per snapshot
 */
export const createBulkTestSnapshots = async (
  count: number = 20,
  windowCount: number = 3,
  tabsPerSnapshot: number = 10
): Promise<boolean> => {
  try {
    console.log(
      `Creating ${count} test snapshots across ${windowCount} windows...`
    );

    // Get all existing snapshots
    const snapshots = await getAllSnapshots();

    // Create fake window IDs if needed
    const windowIds: string[] = [];
    for (let i = 0; i < windowCount; i++) {
      // Create a random UUID-like ID for each test window
      const newId = `test-window-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}-${i}`;
      windowIds.push(newId);
    }

    // Create a snapshot for each window
    for (let i = 0; i < windowCount; i++) {
      const windowId = windowIds[i];

      // Create a test snapshot
      const snapshot: WindowSnapshot = {
        timestamp: Date.now() - i * 60000, // Space them out in time
        tabs: createTestTabs(tabsPerSnapshot),
        groups: [],
        customName: `Test Window ${i + 1}`,
      };

      // Add snapshot to the map
      snapshots[windowId] = snapshot;
    }

    // Save all snapshots
    await saveAllSnapshots(snapshots);
    console.log(`Successfully created ${windowCount} test windows`);

    // Update storage stats
    await updateStorageStats();

    return true;
  } catch (err) {
    console.error("Error creating bulk test snapshots:", err);
    return false;
  }
};

/**
 * Create an array of test tabs
 * @param count Number of tabs to create
 * @returns Array of test tab data
 */
const createTestTabs = (count: number): TabData[] => {
  const tabs: TabData[] = [];

  const testUrls = [
    "https://www.google.com",
    "https://www.github.com",
    "https://www.example.com",
    "https://developer.mozilla.org",
    "https://stackoverflow.com",
    "https://news.ycombinator.com",
    "https://www.reddit.com",
    "https://www.wikipedia.org",
    "https://www.youtube.com",
    "https://www.twitter.com",
  ];

  const testTitles = [
    "Google",
    "GitHub",
    "Example Domain",
    "MDN Web Docs",
    "Stack Overflow",
    "Hacker News",
    "Reddit",
    "Wikipedia",
    "YouTube",
    "Twitter",
  ];

  for (let i = 0; i < count; i++) {
    // Pick a random site from our list, or cycle through them
    const siteIndex = i % testUrls.length;

    tabs.push({
      id: 1000 + i,
      url: testUrls[siteIndex],
      title: `${testTitles[siteIndex]} - Tab ${i + 1}`,
      pinned: i === 0, // First tab is pinned
      groupId: -1,
      index: i,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${testUrls[siteIndex]}`,
    });
  }

  return tabs;
};

/**
 * Test window reopening detection by creating a snapshot and opening a matching window
 * This simulates a user reopening a window through Chrome history
 * @returns Promise resolving to the test snapshot's oopsWindowId if successful
 */
export const testWindowReopeningDetection = async (): Promise<
  string | null
> => {
  try {
    console.log("Testing window reopening detection...");

    // Create a unique test window ID
    const testWindowId = `test-reopen-${Date.now()}`;

    // Create test URLs that are easily identifiable
    const testUrls = [
      "https://example.com/test-reopen-1",
      "https://example.com/test-reopen-2",
      "https://github.com/test-reopen-page",
    ];

    // Create a test snapshot with these URLs
    const { getAllSnapshots, saveAllSnapshots } = await import(
      "./snapshotManager"
    );
    const snapshots = await getAllSnapshots();

    // Create a test snapshot
    snapshots[testWindowId] = {
      timestamp: Date.now(),
      tabs: testUrls.map((url, index) => ({
        id: index,
        url,
        title: `Test Tab ${index + 1}`,
        pinned: false,
        groupId: -1,
        index,
        faviconUrl: "",
      })),
      groups: [],
      customName: "Test Reopened Window",
    };

    // Save the test snapshot
    await saveAllSnapshots(snapshots);
    console.log(`Created test snapshot with ID ${testWindowId}`);

    // Now open a new window with the same URLs to trigger the detection
    const browser = (await import("./browserAPI")).default;
    const newWindow = await browser.windows.create({
      url: testUrls[0], // Open with the first URL
    });

    if (!newWindow.id) {
      console.error("Failed to create test window");
      return null;
    }

    // Add the remaining tabs to this window
    for (let i = 1; i < testUrls.length; i++) {
      await browser.tabs.create({
        url: testUrls[i],
        windowId: newWindow.id,
      });
    }

    console.log(`Created test window with ID ${newWindow.id}`);
    console.log(
      "Wait a moment for the detection to run, then check the extension logs"
    );

    return testWindowId;
  } catch (err) {
    console.error("Error testing window reopening detection:", err);
    return null;
  }
};
