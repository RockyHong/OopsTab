/**
 * Snapshot Manager Utilities for OopsTab
 * Handles creating, storing, and retrieving window snapshots
 */

import { getOopsWindowId } from "./windowTracking";
import browser, { supportsTabGroups } from "./browserAPI";
import {
  TabData,
  TabGroupData,
  WindowSnapshot,
  SnapshotMap,
  OriginalTabData,
  StorageStats,
  DEFAULT_STORAGE_STATS,
  OopsConfig,
  DEFAULT_CONFIG,
  DEFAULT_STORAGE_QUOTA,
  STORAGE_KEYS,
  WindowStateCache,
} from "../types";

// Extract constants from STORAGE_KEYS
const { SNAPSHOTS_KEY, CONFIG_KEY, STORAGE_STATS_KEY } = STORAGE_KEYS;

// Add a Set to track oopsWindowIds that have been deleted but still have active windows
// This helps us recover snapshots for windows that were deleted in the UI
const deletedWindowSnapshots = new Set<string>();

// Add a temporary cache to store the last known state of windows
// This is used when windows are closed and we need to create a final snapshot
// Map of windowId to cached snapshot data
const windowStateCache = new Map<number, WindowStateCache>();

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
const extractOriginalTabData = (tab: any): OriginalTabData | null => {
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
 * Cache the current state of a window for use if it's closed
 * @param windowId The window ID to cache
 */
export const cacheWindowState = async (windowId: number): Promise<void> => {
  try {
    // Get the oopsWindowId for this window
    const oopsWindowId = await getOopsWindowId(windowId);

    // Get tabs in this window
    const tabs = await browser.tabs.query({ windowId });

    // Don't cache empty windows
    if (tabs.length === 0) {
      return;
    }

    // Collect tab group information
    const groupIds = new Set<number>();
    tabs.forEach((tab) => {
      if (tab.groupId && tab.groupId !== -1) {
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
          groupId: tab.groupId || -1,
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

    // Store in the cache
    windowStateCache.set(windowId, {
      timestamp: Date.now(),
      tabsData,
      groups,
      oopsWindowId,
    });

    console.log(
      `Cached state for window ${windowId} with ${tabs.length} tabs for potential closure`
    );

    // Set a timeout to remove this from cache after 30 seconds
    // In case the window doesn't actually close
    setTimeout(() => {
      if (windowStateCache.has(windowId)) {
        windowStateCache.delete(windowId);
        console.log(`Removed stale window state cache for window ${windowId}`);
      }
    }, 30000);
  } catch (err) {
    console.error(`Error caching window state for ${windowId}:`, err);
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

    // Get existing snapshots to check if this window already has a snapshot
    const snapshots = await getAllSnapshots();
    const existingSnapshot = snapshots[oopsWindowId];

    // Create the snapshot (preserving starred status and custom name if it exists)
    const snapshot: WindowSnapshot = {
      timestamp: Date.now(),
      tabs: tabsData,
      groups,
      customName: existingSnapshot?.customName,
      isStarred: existingSnapshot?.isStarred,
    };

    // Update the snapshot for this window
    snapshots[oopsWindowId] = snapshot;

    // Save back to storage
    await saveAllSnapshots(snapshots);

    // Also cache the window state for potential window closure
    // This ensures we have the latest state cached at all times
    windowStateCache.set(windowId, {
      timestamp: Date.now(),
      tabsData,
      groups,
      oopsWindowId,
    });
    console.log(
      `Cached state for window ${windowId} with ${tabs.length} tabs along with snapshot`
    );

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

  // Track this ID as deleted but possibly still active
  deletedWindowSnapshots.add(oopsWindowId);

  // Delete the snapshot but don't remove window ID mapping
  delete allSnapshots[oopsWindowId];
  await saveAllSnapshots(allSnapshots);

  console.log(
    `Deleted snapshot for window ${oopsWindowId} (window tracking preserved, marked as deleted but active window)`
  );
  return true;
};

/**
 * Delete all snapshots from storage
 * @returns Promise resolving to true if deletion was successful
 */
export const deleteAllSnapshots = async (): Promise<boolean> => {
  try {
    // Get all snapshots first
    const allSnapshots = await getAllSnapshots();

    // Track all deleted IDs
    for (const oopsWindowId of Object.keys(allSnapshots)) {
      deletedWindowSnapshots.add(oopsWindowId);
    }

    await saveAllSnapshots({}); // Save an empty map
    console.log(
      "Deleted all snapshots (tracking active windows for save-on-close)"
    );
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

/**
 * Create a final snapshot of a window when it's being closed
 * This version doesn't skip single-tab windows like createWindowSnapshot does
 * @param windowId Window ID to snapshot
 * @returns Promise resolving to true if snapshot was created
 */
export const createFinalWindowSnapshot = async (
  windowId: number
): Promise<boolean> => {
  try {
    // Get the oopsWindowId for this window
    const oopsWindowId = await getOopsWindowId(windowId);
    if (!oopsWindowId) {
      console.error(`No oopsWindowId found for window ${windowId}`);
      return false;
    }

    console.log(
      `Creating final snapshot for window ${windowId} with oopsWindowId ${oopsWindowId}`
    );

    // Check if this window was previously deleted in the UI
    const wasDeleted = deletedWindowSnapshots.has(oopsWindowId);
    if (wasDeleted) {
      console.log(
        `Window ${windowId} (${oopsWindowId}) was previously deleted in UI, will force save on close`
      );
      // Remove from our tracking set since we're handling it now
      deletedWindowSnapshots.delete(oopsWindowId);
    }

    // Check if we have cached data for this window (because it might be closed already)
    const cachedData = windowStateCache.get(windowId);

    // Get tabs in this window if it's still open
    let tabs;
    let usedCache = false;
    try {
      tabs = await browser.tabs.query({ windowId });

      // If we got no tabs but have cached data, use the cache
      if ((!tabs || tabs.length === 0) && cachedData) {
        console.log(
          `Window ${windowId} has no tabs, using cached data with ${cachedData.tabsData.length} tabs`
        );
        usedCache = true;
      }
    } catch (e) {
      console.log(
        `Window ${windowId} appears to be closed already, will try to use cached data`
      );
      if (cachedData) {
        usedCache = true;
      } else {
        console.error(`No cached data available for closed window ${windowId}`);
        return false;
      }
    }

    // If we need to use cached data
    let tabsData: TabData[] = [];
    let groups: TabGroupData[] = [];

    if (usedCache && cachedData) {
      // Use the cached data
      tabsData = cachedData.tabsData;
      groups = cachedData.groups;

      // Now that we've used the cache, remove it
      windowStateCache.delete(windowId);
      console.log(`Used and removed cached data for window ${windowId}`);
    } else {
      // Don't create snapshots for empty windows if we don't have cached data
      if (!tabs || tabs.length === 0) {
        console.log(
          `Skipping final snapshot for window ${windowId} - no tabs and no cached data`
        );
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
      groups = [];
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

      // Create tab data
      tabsData = tabs.map((tab) => {
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
    }

    // Create the snapshot
    const snapshot: WindowSnapshot = {
      timestamp: Date.now(),
      tabs: tabsData,
      groups,
    };

    // Get existing snapshots
    const snapshots = await getAllSnapshots();
    const existingSnapshot = snapshots[oopsWindowId];

    // Preserve starred status and custom name if they exist
    if (existingSnapshot) {
      if (existingSnapshot.customName) {
        snapshot.customName = existingSnapshot.customName;
      }
      if (existingSnapshot.isStarred) {
        snapshot.isStarred = existingSnapshot.isStarred;
      }
    }

    // Update the snapshot for this window
    snapshots[oopsWindowId] = snapshot;

    // Save back to storage
    await saveAllSnapshots(snapshots);

    console.log(
      `Created final snapshot for closing window ${windowId} with ${
        tabsData.length
      } tabs${wasDeleted ? " (recovered after UI deletion)" : ""}${
        usedCache ? " (used cached data)" : ""
      }`
    );
    return true;
  } catch (err) {
    console.error("Error creating final window snapshot:", err);
    return false;
  }
};

/**
 * Reset the tracker for deleted windows
 * Call this on extension startup
 */
export const resetDeletedWindowTracking = (): void => {
  // Clear the set of tracked deleted windows
  deletedWindowSnapshots.clear();
  console.log("Deleted window tracking reset");
};

/**
 * Toggle star status for a snapshot
 * @param oopsWindowId The oopsWindowId to star/unstar
 * @param isStarred Whether to star or unstar the snapshot
 * @returns Promise resolving to true if the operation was successful
 */
export const toggleSnapshotStar = async (
  oopsWindowId: string,
  isStarred: boolean
): Promise<boolean> => {
  try {
    const snapshots = await getAllSnapshots();

    if (!snapshots[oopsWindowId]) {
      console.error(`No snapshot found for window ${oopsWindowId}`);
      return false;
    }

    // Update the isStarred property
    snapshots[oopsWindowId].isStarred = isStarred;

    // Save back to storage
    await saveAllSnapshots(snapshots);

    console.log(
      `${
        isStarred ? "Starred" : "Unstarred"
      } snapshot for window ${oopsWindowId}`
    );
    return true;
  } catch (err) {
    console.error("Error toggling snapshot star:", err);
    return false;
  }
};

/**
 * Cleanup old snapshots while preserving starred ones
 * @param maxAge Maximum age in milliseconds to keep non-starred snapshots (default: 30 days)
 * @param maxCount Maximum number of non-starred snapshots to keep (default: 20)
 * @returns Promise resolving to true if cleanup was successful
 */
export const cleanupSnapshots = async (
  maxAge: number = 30 * 24 * 60 * 60 * 1000, // 30 days default
  maxCount: number = 20
): Promise<boolean> => {
  try {
    // Get all snapshots
    const allSnapshots = await getAllSnapshots();

    // Separate starred and non-starred snapshots
    const starred: [string, WindowSnapshot][] = [];
    const nonStarred: [string, WindowSnapshot][] = [];

    Object.entries(allSnapshots).forEach(([id, snapshot]) => {
      if (snapshot.isStarred) {
        starred.push([id, snapshot]);
      } else {
        nonStarred.push([id, snapshot]);
      }
    });

    // Sort non-starred snapshots by timestamp, newest first
    nonStarred.sort(([, a], [, b]) => {
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    // Keep only the newest maxCount non-starred snapshots
    const snapshotsToKeep = nonStarred.slice(0, maxCount);

    // Also check age restriction for the remaining snapshots
    const now = Date.now();
    const cutoffTime = now - maxAge;

    // Filter snapshots by age
    const finalNonStarredToKeep = snapshotsToKeep.filter(
      ([, snapshot]) => (snapshot.timestamp || 0) >= cutoffTime
    );

    // Build new snapshot map with starred + filtered non-starred
    const newSnapshotMap: SnapshotMap = {};

    // Add all starred snapshots (these are always kept)
    starred.forEach(([id, snapshot]) => {
      newSnapshotMap[id] = snapshot;
    });

    // Add filtered non-starred snapshots
    finalNonStarredToKeep.forEach(([id, snapshot]) => {
      newSnapshotMap[id] = snapshot;
    });

    // Calculate how many were removed
    const removedCount =
      Object.keys(allSnapshots).length - Object.keys(newSnapshotMap).length;

    // Save the filtered snapshot map
    await saveAllSnapshots(newSnapshotMap);

    console.log(
      `Cleaned up snapshots: kept ${starred.length} starred and ${finalNonStarredToKeep.length} recent non-starred snapshots, removed ${removedCount}`
    );
    return true;
  } catch (err) {
    console.error("Error cleaning up snapshots:", err);
    return false;
  }
};
