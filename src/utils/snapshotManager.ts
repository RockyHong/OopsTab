/**
 * Snapshot Manager Utilities for OopsTab
 * Handles creating, storing, and retrieving window snapshots
 */

import { getOopsWindowId } from "./windowTracking";
import browser, { supportsTabGroups } from "./browserAPI";

// Storage keys
const SNAPSHOTS_KEY = "oopsSnapshots";
const CONFIG_KEY = "oopsConfig";
const STORAGE_STATS_KEY = "oopsStorageStats";
const DEFAULT_STORAGE_QUOTA = 5 * 1024 * 1024; // 5MB default quota

// Storage statistics interface
export interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  lastUpdate: number;
  itemCounts: {
    windows: number;
  };
}

// Default storage stats
export const DEFAULT_STORAGE_STATS: StorageStats = {
  totalBytes: DEFAULT_STORAGE_QUOTA,
  usedBytes: 0,
  lastUpdate: 0,
  itemCounts: {
    windows: 0,
  },
};

// Default configuration
export interface OopsConfig {
  autosaveDebounce: number; // milliseconds
}

export const DEFAULT_CONFIG: OopsConfig = {
  autosaveDebounce: 5000, // 5 seconds
};

// Types for snapshot data
export interface TabData {
  id: number;
  url: string;
  title: string;
  pinned: boolean;
  groupId: number;
  index: number;
  faviconUrl?: string;
}

// Define proper type for tab group color
type TabGroupColor = any; // Using any for cross-browser compatibility

export interface TabGroupData {
  id: number;
  title?: string;
  color?: TabGroupColor;
  collapsed?: boolean;
}

export interface WindowSnapshot {
  timestamp: number;
  tabs: TabData[];
  groups: TabGroupData[];
  customName?: string; // Custom name for the snapshot
}

// New simplified interface - direct mapping of oopsWindowId to snapshot
export interface SnapshotMap {
  [oopsWindowId: string]: WindowSnapshot;
}

/**
 * Get the current configuration
 * @returns Promise resolving to the current configuration
 */
export const getConfig = async (): Promise<OopsConfig> => {
  try {
    const result = await browser.storage.local.get([CONFIG_KEY]);
    const config = result[CONFIG_KEY] as OopsConfig;

    if (!config) {
      return { ...DEFAULT_CONFIG };
    }

    // Ensure all properties exist with defaults as fallback
    return {
      autosaveDebounce:
        config.autosaveDebounce ?? DEFAULT_CONFIG.autosaveDebounce,
    };
  } catch (err) {
    console.error("Error getting config:", err);
    return { ...DEFAULT_CONFIG };
  }
};

/**
 * Save configuration
 * @param config Configuration to save
 * @returns Promise resolving when config is saved
 */
export const saveConfig = async (config: OopsConfig): Promise<void> => {
  try {
    await browser.storage.local.set({ [CONFIG_KEY]: config });
    console.log("Config saved:", config);
  } catch (err) {
    console.error("Error saving config:", err);
  }
};

/**
 * Get all snapshots from storage
 * @returns Promise resolving to snapshot map
 */
export const getAllSnapshots = async (): Promise<SnapshotMap> => {
  const result = await browser.storage.local.get([SNAPSHOTS_KEY]);
  return (result[SNAPSHOTS_KEY] as SnapshotMap) || {};
};

/**
 * Save snapshots to storage
 * @param snapshotMap The snapshot map to save
 */
export const saveAllSnapshots = async (
  snapshotMap: SnapshotMap
): Promise<void> => {
  await browser.storage.local.set({ [SNAPSHOTS_KEY]: snapshotMap });
  console.log("Snapshots saved:", snapshotMap);

  // Update storage statistics after saving
  await updateStorageStats();
};

/**
 * Check if a tab is a middleware tab and extract the original tab data if so
 * @param tab The tab to check
 * @returns Original tab data if it's a middleware tab, or null if not
 */
const extractOriginalTabData = (
  tab: any
): { url: string; title: string; faviconUrl?: string } | null => {
  try {
    // Check if this is our middleware page
    const extensionUrl = browser.runtime.getURL("middleware-tab.html");
    if (!tab.url || !tab.url.startsWith(extensionUrl)) {
      return null;
    }

    // Parse URL to extract original tab data
    const url = new URL(tab.url);
    const params = new URLSearchParams(url.search);

    // First try to get the stored TabData JSON
    const tabDataParam = params.get("tabdata");
    if (tabDataParam) {
      try {
        return JSON.parse(tabDataParam);
      } catch (e) {
        console.warn("Failed to parse tabdata JSON", e);
      }
    }

    // Fallback to individual params
    const targetUrl = params.get("url");
    if (!targetUrl) {
      return null;
    }

    return {
      url: targetUrl,
      title: params.get("title") || targetUrl,
      faviconUrl: params.get("favicon") || undefined,
    };
  } catch (e) {
    console.warn("Error checking for middleware tab", e);
    return null;
  }
};

/**
 * Create a new snapshot of a window
 * @param windowId Window ID to snapshot
 * @returns Promise resolving to true if snapshot was created
 */
export const createWindowSnapshot = async (
  windowId: number
): Promise<boolean> => {
  try {
    // Get the oopsWindowId for this window
    const oopsWindowId = await getOopsWindowId(windowId);
    if (!oopsWindowId) {
      console.error(`No oopsWindowId found for window ${windowId}`);
      return false;
    }

    // Get tabs in this window
    const tabs = await browser.tabs.query({ windowId });

    // Don't create snapshots for empty windows
    if (tabs.length === 0) {
      console.log(`Skipping snapshot for window ${windowId} - no tabs`);
      return false;
    }

    // Collect tab group information
    const groupIds = new Set<number>();
    tabs.forEach((tab) => {
      if (tab.groupId && tab.groupId !== -1) {
        // -1 is the standard TAB_GROUP_ID_NONE
        groupIds.add(tab.groupId);
      }
    });

    // Get group details
    const groups: TabGroupData[] = [];
    if (supportsTabGroups) {
      for (const groupId of groupIds) {
        try {
          // @ts-ignore - Browser may have inconsistent API shape
          const group = await browser.tabGroups.get(groupId);
          groups.push({
            id: group.id,
            title: group.title,
            color: group.color,
            collapsed: group.collapsed,
          });
        } catch (err) {
          console.warn(`Failed to get group ${groupId}:`, err);
        }
      }
    }

    // Prevent snapshotting single-tab windows unless they have groups
    if (tabs.length === 1 && groups.length === 0) {
      console.log(
        `Skipping snapshot for window ${windowId} - only one tab and no groups`
      );
      // Also attempt to delete any existing snapshot for this window
      // in case it previously had more tabs/groups
      try {
        const snapshots = await getAllSnapshots();
        if (snapshots[oopsWindowId]) {
          delete snapshots[oopsWindowId];
          await saveAllSnapshots(snapshots);
          console.log(
            `Deleted existing snapshot for single-tab window ${windowId}`
          );
        }
      } catch (delErr) {
        console.error(
          `Error trying to delete existing snapshot for window ${windowId}:`,
          delErr
        );
      }
      return false; // Do not proceed to create/save the snapshot
    }

    // Create tab data
    const tabsData: TabData[] = tabs.map((tab) => {
      // Check if this is a middleware tab
      const originalTabData = extractOriginalTabData(tab);

      if (originalTabData) {
        // Use the original tab data stored in the middleware tab
        return {
          id: tab.id || 0,
          url: originalTabData.url,
          title: originalTabData.title,
          pinned: tab.pinned || false,
          groupId: tab.groupId || -1, // -1 is the standard TAB_GROUP_ID_NONE
          index: tab.index,
          faviconUrl: originalTabData.faviconUrl || "",
        };
      }

      // Regular tab
      return {
        id: tab.id || 0,
        url: tab.url || "",
        title: tab.title || "",
        pinned: tab.pinned || false,
        groupId: tab.groupId || -1,
        index: tab.index,
        faviconUrl: tab.favIconUrl || "",
      };
    });

    // Create the snapshot
    const snapshot: WindowSnapshot = {
      timestamp: Date.now(),
      tabs: tabsData,
      groups,
    };

    // Get existing snapshots
    const snapshots = await getAllSnapshots();

    // Update the snapshot for this window
    snapshots[oopsWindowId] = snapshot;

    // Save back to storage
    await saveAllSnapshots(snapshots);

    console.log(
      `Created snapshot for window ${windowId} with ${tabs.length} tabs`
    );
    return true;
  } catch (err) {
    console.error("Error creating window snapshot:", err);
    return false;
  }
};

/**
 * Get snapshot for a specific window by oopsWindowId
 * @param oopsWindowId The oopsWindowId to find snapshot for
 * @returns Promise resolving to the window snapshot or null if not found
 */
export const getWindowSnapshot = async (
  oopsWindowId: string
): Promise<WindowSnapshot | null> => {
  const allSnapshots = await getAllSnapshots();
  return allSnapshots[oopsWindowId] || null;
};

/**
 * Delete a snapshot for a specific window
 * @param oopsWindowId The oopsWindowId to delete snapshot for
 * @returns Promise resolving to true if deletion was successful
 */
export const deleteSnapshot = async (
  oopsWindowId: string
): Promise<boolean> => {
  const allSnapshots = await getAllSnapshots();

  if (!allSnapshots[oopsWindowId]) return false;

  delete allSnapshots[oopsWindowId];
  await saveAllSnapshots(allSnapshots);

  console.log(`Deleted snapshot for window ${oopsWindowId}`);
  return true;
};

/**
 * Delete all snapshots from storage
 * @returns Promise resolving to true if deletion was successful
 */
export const deleteAllSnapshots = async (): Promise<boolean> => {
  try {
    await saveAllSnapshots({}); // Save an empty map
    console.log("Deleted all snapshots");
    return true;
  } catch (err) {
    console.error("Error deleting all snapshots:", err);
    return false;
  }
};

/**
 * Rename a snapshot with a custom name
 * @param oopsWindowId The oopsWindowId of the window
 * @param newName The new custom name for the snapshot
 * @returns Promise resolving to true if snapshot was renamed
 */
export const renameSnapshot = async (
  oopsWindowId: string,
  newName: string
): Promise<boolean> => {
  try {
    // Get all snapshots
    const snapshots = await getAllSnapshots();

    // Find the snapshot
    const snapshot = snapshots[oopsWindowId];
    if (!snapshot) {
      console.error(`No snapshot found for ${oopsWindowId}`);
      return false;
    }

    // Update name
    snapshot.customName = newName.trim();

    // Save back to storage
    await saveAllSnapshots(snapshots);
    console.log(`Snapshot for ${oopsWindowId} renamed to "${newName}"`);
    return true;
  } catch (err) {
    console.error("Error renaming snapshot:", err);
    return false;
  }
};

/**
 * Calculate the size of a snapshot in bytes (approximate)
 * @param snapshot The snapshot to measure
 * @returns The size in bytes (approximate)
 */
export const calculateSnapshotSize = (snapshot: WindowSnapshot): number => {
  // Convert to JSON and measure string length for a rough byte estimation
  return JSON.stringify(snapshot).length;
};

/**
 * Get current storage statistics
 * @returns Promise resolving to storage statistics
 */
export const getStorageStats = async (): Promise<StorageStats> => {
  try {
    // Get stored stats
    const result = await browser.storage.local.get([STORAGE_STATS_KEY]);
    const stats = result[STORAGE_STATS_KEY] as StorageStats;

    if (!stats) {
      return { ...DEFAULT_STORAGE_STATS };
    }

    // Return stored stats with defaults for any missing properties
    return {
      totalBytes: stats.totalBytes || DEFAULT_STORAGE_QUOTA,
      usedBytes: stats.usedBytes || 0,
      lastUpdate: stats.lastUpdate || 0,
      itemCounts: {
        windows: stats.itemCounts?.windows || 0,
      },
    };
  } catch (err) {
    console.error("Error getting storage stats:", err);
    return { ...DEFAULT_STORAGE_STATS };
  }
};

/**
 * Update storage statistics based on current entries
 * @returns Promise resolving to the updated stats
 */
export const updateStorageStats = async (): Promise<StorageStats> => {
  try {
    // Get all snapshots
    const snapshots = await getAllSnapshots();

    // Calculate stats
    let totalSize = 0;
    const windowCount = Object.keys(snapshots).length;

    for (const oopsWindowId in snapshots) {
      const snapshot = snapshots[oopsWindowId];
      const snapshotSize = calculateSnapshotSize(snapshot);
      totalSize += snapshotSize;
    }

    // Get browser storage quota if available
    let storageQuota = DEFAULT_STORAGE_QUOTA;
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) {
          storageQuota = estimate.quota;
        }
      } catch (e) {
        console.warn("Error getting storage quota:", e);
      }
    }

    // Create updated stats
    const stats: StorageStats = {
      totalBytes: storageQuota,
      usedBytes: totalSize,
      lastUpdate: Date.now(),
      itemCounts: {
        windows: windowCount,
      },
    };

    // Save updated stats
    await browser.storage.local.set({ [STORAGE_STATS_KEY]: stats });
    return stats;
  } catch (err) {
    console.error("Error updating storage stats:", err);
    return { ...DEFAULT_STORAGE_STATS };
  }
};

/**
 * Check if we are approaching storage limits
 * @returns Promise resolving to an object with warning status
 */
export const checkStorageLimits = async (): Promise<{
  isApproachingLimit: boolean;
  percentUsed: number;
  warningMessage?: string;
}> => {
  try {
    const stats = await getStorageStats();
    const percentUsed = (stats.usedBytes / stats.totalBytes) * 100;

    // Warning thresholds
    if (percentUsed > 90) {
      return {
        isApproachingLimit: true,
        percentUsed,
        warningMessage:
          "Critical: Storage usage is over 90%. Delete some snapshots.",
      };
    } else if (percentUsed > 75) {
      return {
        isApproachingLimit: true,
        percentUsed,
        warningMessage: "Warning: Storage usage is over 75%.",
      };
    } else if (percentUsed > 60) {
      return {
        isApproachingLimit: true,
        percentUsed,
        warningMessage: "Note: Storage usage is over 60%.",
      };
    }

    return { isApproachingLimit: false, percentUsed };
  } catch (err) {
    console.error("Error checking storage limits:", err);
    return { isApproachingLimit: false, percentUsed: 0 };
  }
};
