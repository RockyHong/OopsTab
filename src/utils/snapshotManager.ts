/**
 * Snapshot Manager Utilities for OopsTab
 * Handles creating, storing, and retrieving window snapshots
 */

import {
  getOopsWindowId,
  getWindowIdMap,
  saveWindowIdMap,
} from "./windowTracking";
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

// Max size for sync storage chunks (80KB to stay safely under Chrome's 100KB limit)
const MAX_SYNC_CHUNK_SIZE = 80 * 1024;

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
      syncEnabled: config.syncEnabled ?? DEFAULT_CONFIG.syncEnabled,
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
  try {
    // First get from local storage
    const result = await browser.storage.local.get([SNAPSHOTS_KEY]);
    let snapshots = (result[SNAPSHOTS_KEY] as SnapshotMap) || {};

    // Try to merge with sync data if available
    const config = await getConfig();
    if (config.syncEnabled) {
      try {
        const syncedSnapshots = await getAllSnapshotsFromSync();
        if (syncedSnapshots && Object.keys(syncedSnapshots).length > 0) {
          // Merge snapshots, preferring the more recent version
          for (const [id, snapshot] of Object.entries(syncedSnapshots)) {
            if (
              !snapshots[id] ||
              snapshots[id].timestamp < snapshot.timestamp
            ) {
              snapshots[id] = snapshot;
            }
          }

          // If we got sync data but local is empty or outdated, save the merged result locally
          await browser.storage.local.set({ [SNAPSHOTS_KEY]: snapshots });
        }
      } catch (err) {
        console.error("Error getting snapshots from sync:", err);
      }
    }

    return snapshots;
  } catch (err) {
    console.error("Error getting snapshots:", err);
    return {};
  }
};

/**
 * Save snapshots to storage
 * @param snapshotMap The snapshot map to save
 */
export const saveAllSnapshots = async (
  snapshotMap: SnapshotMap
): Promise<void> => {
  try {
    // Always save to local storage
    await browser.storage.local.set({ [SNAPSHOTS_KEY]: snapshotMap });
    console.log("Snapshots saved to local storage:", snapshotMap);

    // Check if sync is enabled
    const config = await getConfig();
    if (config.syncEnabled) {
      try {
        await saveAllSnapshotsToSync(snapshotMap);
        console.log("Snapshots also saved to sync storage");
      } catch (err) {
        console.error("Error saving snapshots to sync storage:", err);
      }
    }

    // Update storage statistics after saving
    await updateStorageStats();
  } catch (err) {
    console.error("Error saving snapshots:", err);
  }
};

/**
 * Save snapshots to browser sync storage
 * Uses chunking to handle browser limits
 * @param snapshotMap The snapshot map to save
 */
export const saveAllSnapshotsToSync = async (
  snapshotMap: SnapshotMap
): Promise<void> => {
  try {
    // Get keys to clear old chunks
    const existingKeys = await browser.storage.sync.get(null);
    const chunkKeysToRemove = Object.keys(existingKeys).filter((key) =>
      key.startsWith(SNAPSHOTS_KEY + "_chunk_")
    );

    if (chunkKeysToRemove.length > 0) {
      await browser.storage.sync.remove(chunkKeysToRemove);
    }

    // Convert to string
    const snapshotsStr = JSON.stringify(snapshotMap);

    // If data is too large, use chunking
    if (snapshotsStr.length > MAX_SYNC_CHUNK_SIZE) {
      const chunks: Record<string, string> = {};
      let chunkCount = 0;

      // Create chunks of appropriate size
      for (let i = 0; i < snapshotsStr.length; i += MAX_SYNC_CHUNK_SIZE) {
        const chunkKey = `${SNAPSHOTS_KEY}_chunk_${chunkCount}`;
        chunks[chunkKey] = snapshotsStr.substring(i, i + MAX_SYNC_CHUNK_SIZE);
        chunkCount++;
      }

      // Save chunk info
      await browser.storage.sync.set({
        [`${SNAPSHOTS_KEY}_chunks`]: chunkCount,
      });

      // Save each chunk
      for (const [key, value] of Object.entries(chunks)) {
        await browser.storage.sync.set({ [key]: value });
      }

      console.log(`Saved ${chunkCount} chunks to sync storage`);
    } else {
      // Small enough to save directly
      await browser.storage.sync.set({
        [SNAPSHOTS_KEY]: snapshotMap,
        [`${SNAPSHOTS_KEY}_chunks`]: 0, // Indicate no chunking
      });
    }
  } catch (err) {
    console.error("Error saving to sync storage:", err);
    throw err;
  }
};

/**
 * Get all snapshots from browser sync storage
 * Handles chunked data if present
 * @returns Promise resolving to snapshot map or null if not found
 */
export const getAllSnapshotsFromSync =
  async (): Promise<SnapshotMap | null> => {
    try {
      // Check if data is chunked
      const chunkInfo = await browser.storage.sync.get([
        `${SNAPSHOTS_KEY}_chunks`,
      ]);
      const chunkCount = chunkInfo[`${SNAPSHOTS_KEY}_chunks`] as
        | number
        | undefined;

      if (chunkCount === undefined) {
        // No sync data available
        return null;
      }

      if (chunkCount === 0) {
        // Not chunked, get direct data
        const result = await browser.storage.sync.get([SNAPSHOTS_KEY]);
        return (result[SNAPSHOTS_KEY] as SnapshotMap) || null;
      }

      // Get all chunks
      const chunkKeys = Array.from(
        { length: chunkCount },
        (_, i) => `${SNAPSHOTS_KEY}_chunk_${i}`
      );

      const chunks = await browser.storage.sync.get(chunkKeys);

      // Combine chunks
      let completeStr = "";
      for (let i = 0; i < chunkCount; i++) {
        const key = `${SNAPSHOTS_KEY}_chunk_${i}`;
        if (chunks[key]) {
          completeStr += chunks[key];
        } else {
          console.error(`Missing chunk ${i} in sync storage`);
          return null;
        }
      }

      // Parse combined data
      return JSON.parse(completeStr) as SnapshotMap;
    } catch (err) {
      console.error("Error getting from sync storage:", err);
      return null;
    }
  };

/**
 * Export snapshots to a JSON file
 * @returns JSON string of all snapshots
 */
export const exportSnapshots = async (): Promise<string> => {
  try {
    const snapshots = await getAllSnapshots();
    return JSON.stringify(snapshots, null, 2); // Pretty-printed JSON
  } catch (err) {
    console.error("Error exporting snapshots:", err);
    throw new Error("Failed to export snapshots");
  }
};

/**
 * Import snapshots from a JSON string
 * @param jsonData JSON string containing snapshots
 * @returns Promise resolving to an object with import results
 */
export const importSnapshots = async (
  jsonData: string
): Promise<{ success: boolean; count: number }> => {
  try {
    const importedSnapshots = JSON.parse(jsonData) as SnapshotMap;

    // Validate imported data
    if (!importedSnapshots || typeof importedSnapshots !== "object") {
      throw new Error("Invalid snapshot data format");
    }

    // Get existing snapshots to merge with
    const existingSnapshots = await getAllSnapshots();

    // Count imported snapshots
    const importCount = Object.keys(importedSnapshots).length;

    // Merge snapshots, preferring the more recent version
    for (const [id, snapshot] of Object.entries(importedSnapshots)) {
      if (
        !existingSnapshots[id] ||
        existingSnapshots[id].timestamp < snapshot.timestamp
      ) {
        existingSnapshots[id] = snapshot;
      }
    }

    // Save merged snapshots
    await saveAllSnapshots(existingSnapshots);
    return { success: true, count: importCount };
  } catch (err) {
    console.error("Error importing snapshots:", err);
    throw new Error(
      "Failed to import snapshots: " +
        (err instanceof Error ? err.message : String(err))
    );
  }
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

    // Check for similar snapshots and merge if needed
    const { mergedSnapshots, mergedInto } = mergeSnapshots(
      snapshot,
      oopsWindowId,
      snapshots
    );

    // If this snapshot was merged into another, update the window ID mapping
    if (mergedInto && mergedInto !== oopsWindowId) {
      // We need to update the window ID mapping to point to the snapshot it was merged into
      const idMap = await getWindowIdMap();
      idMap[windowId] = mergedInto;
      await saveWindowIdMap(idMap);
      console.log(
        `Updated window ${windowId} mapping to point to merged snapshot ${mergedInto}`
      );
    }

    // Save back to storage
    await saveAllSnapshots(mergedSnapshots);

    // Also cache the window state for potential window closure
    // This ensures we have the latest state cached at all times
    windowStateCache.set(windowId, {
      timestamp: Date.now(),
      tabsData,
      groups,
      oopsWindowId: mergedInto || oopsWindowId, // Use merged ID if available
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

/**
 * Check if two snapshots are similar based on their URLs and structure
 * @param snapshot1 First snapshot to compare
 * @param snapshot2 Second snapshot to compare
 * @returns An object with similarity percentage and details
 */
const calculateSnapshotSimilarity = (
  snapshot1: WindowSnapshot,
  snapshot2: WindowSnapshot
): {
  similarityPercentage: number;
  urlMatchPercentage: number;
  groupSimilarity: number;
  timestamp: number;
} => {
  // Extract URLs from each snapshot
  const urls1 = new Set(snapshot1.tabs.map((tab) => tab.url));
  const urls2 = new Set(snapshot2.tabs.map((tab) => tab.url));

  // Count URL matches
  let matches = 0;
  for (const url of urls1) {
    if (urls2.has(url)) matches++;
  }

  // Calculate URL match percentage using the smaller set as denominator for higher accuracy
  const urlMatchPercentage = (matches / Math.min(urls1.size, urls2.size)) * 100;

  // Calculate group similarity (0-1 scale)
  let groupSimilarity = 0;
  if (snapshot1.groups.length > 0 && snapshot2.groups.length > 0) {
    // Compare group titles and structure
    const titles1 = new Set(
      snapshot1.groups.map((g) => g.title).filter(Boolean)
    );
    const titles2 = new Set(
      snapshot2.groups.map((g) => g.title).filter(Boolean)
    );

    // Calculate title overlap
    let titleMatches = 0;
    for (const title of titles1) {
      if (title && titles2.has(title)) titleMatches++;
    }

    const titleSimilarity =
      titles1.size > 0
        ? titleMatches / Math.min(titles1.size, titles2.size)
        : 0;

    // Group count similarity
    const countSimilarity =
      1 -
      Math.abs(snapshot1.groups.length - snapshot2.groups.length) /
        Math.max(snapshot1.groups.length, snapshot2.groups.length, 1);

    groupSimilarity = (titleSimilarity + countSimilarity) / 2;
  } else if (snapshot1.groups.length === 0 && snapshot2.groups.length === 0) {
    // Both have no groups, consider them similar in this aspect
    groupSimilarity = 1;
  }

  // Calculate overall similarity (URL match is weighted more)
  const similarityPercentage =
    urlMatchPercentage * 0.7 + groupSimilarity * 100 * 0.3;

  // Use newer timestamp to determine the newer snapshot
  const timestamp = Math.max(snapshot1.timestamp, snapshot2.timestamp);

  return {
    similarityPercentage,
    urlMatchPercentage,
    groupSimilarity,
    timestamp,
  };
};

/**
 * Merge similar snapshots to prevent duplicates
 * @param newSnapshot The new snapshot to check for merging
 * @param newOopsWindowId The oopsWindowId of the new snapshot
 * @param allSnapshots The map of all existing snapshots
 * @param similarityThreshold The threshold for considering snapshots similar (default: 75%)
 * @returns Map of snapshots with duplicates merged
 */
export const mergeSnapshots = (
  newSnapshot: WindowSnapshot,
  newOopsWindowId: string,
  allSnapshots: SnapshotMap,
  similarityThreshold: number = 75
): { mergedSnapshots: SnapshotMap; mergedInto: string | null } => {
  // Create a copy of all snapshots to work with
  const mergedSnapshots: SnapshotMap = { ...allSnapshots };

  // Add the new snapshot to the map
  mergedSnapshots[newOopsWindowId] = newSnapshot;

  // If there are less than 2 snapshots, no merging needed
  if (Object.keys(mergedSnapshots).length < 2) {
    return { mergedSnapshots, mergedInto: null };
  }

  // Check for similar snapshots
  let mostSimilarId: string | null = null;
  let highestSimilarity = 0;

  for (const [oopsWindowId, snapshot] of Object.entries(mergedSnapshots)) {
    // Skip comparing with itself
    if (oopsWindowId === newOopsWindowId) continue;

    const similarity = calculateSnapshotSimilarity(newSnapshot, snapshot);

    if (
      similarity.similarityPercentage >= similarityThreshold &&
      similarity.similarityPercentage > highestSimilarity
    ) {
      highestSimilarity = similarity.similarityPercentage;
      mostSimilarId = oopsWindowId;
    }
  }

  // If we found a similar snapshot, merge them
  if (mostSimilarId) {
    const existingSnapshot = mergedSnapshots[mostSimilarId];

    // Decide which snapshot to keep based on:
    // 1. Starred status (keep starred snapshots)
    // 2. Custom name (prefer snapshots with custom names)
    // 3. Tab count (prefer the one with more tabs)
    // 4. Timestamp (prefer newer snapshot)
    let keepExisting = false;

    if (existingSnapshot.isStarred && !newSnapshot.isStarred) {
      keepExisting = true;
    } else if (existingSnapshot.customName && !newSnapshot.customName) {
      keepExisting = true;
    } else if (existingSnapshot.tabs.length > newSnapshot.tabs.length) {
      keepExisting = true;
    }

    if (keepExisting) {
      // Update the timestamp to the newer one
      mergedSnapshots[mostSimilarId] = {
        ...existingSnapshot,
        timestamp: Math.max(existingSnapshot.timestamp, newSnapshot.timestamp),
      };
      // Remove the new snapshot
      delete mergedSnapshots[newOopsWindowId];
      console.log(
        `Merged new snapshot for ${newOopsWindowId} into existing snapshot ${mostSimilarId} (${highestSimilarity.toFixed(
          2
        )}% similarity)`
      );
      return { mergedSnapshots, mergedInto: mostSimilarId };
    } else {
      // Keep the new snapshot, but preserve any valuable info from the existing one
      mergedSnapshots[newOopsWindowId] = {
        ...newSnapshot,
        isStarred: existingSnapshot.isStarred || newSnapshot.isStarred,
        customName: newSnapshot.customName || existingSnapshot.customName,
      };
      // Remove the existing snapshot
      delete mergedSnapshots[mostSimilarId];
      console.log(
        `Merged existing snapshot ${mostSimilarId} into new snapshot ${newOopsWindowId} (${highestSimilarity.toFixed(
          2
        )}% similarity)`
      );
      return { mergedSnapshots, mergedInto: newOopsWindowId };
    }
  }

  // No similar snapshots found, return original map with the new snapshot
  return { mergedSnapshots, mergedInto: null };
};

/**
 * Deduplicate snapshots by finding and merging similar ones
 * Can be called periodically or manually to clean up duplicates
 * @param similarityThreshold The threshold for considering snapshots similar (default: 75%)
 * @returns Promise resolving to the number of merges performed
 */
export const deduplicateSnapshots = async (
  similarityThreshold: number = 75
): Promise<number> => {
  try {
    // Get all snapshots
    const snapshots = await getAllSnapshots();
    const snapshotIds = Object.keys(snapshots);

    // If there are less than 2 snapshots, no deduplication needed
    if (snapshotIds.length < 2) {
      return 0;
    }

    // Track the number of merges performed
    let mergeCount = 0;

    // Keep track of oopsWindowIds that were merged and their new mappings
    const idMappings: Record<string, string> = {};

    // Compare each snapshot with others
    for (let i = 0; i < snapshotIds.length; i++) {
      const id1 = snapshotIds[i];

      // Skip if this snapshot was already merged into another
      if (idMappings[id1]) continue;

      const snapshot1 = snapshots[id1];
      if (!snapshot1) continue; // Skip if somehow missing

      for (let j = i + 1; j < snapshotIds.length; j++) {
        const id2 = snapshotIds[j];

        // Skip if this snapshot was already merged into another
        if (idMappings[id2]) continue;

        const snapshot2 = snapshots[id2];
        if (!snapshot2) continue; // Skip if somehow missing

        // Calculate similarity
        const similarity = calculateSnapshotSimilarity(snapshot1, snapshot2);

        // If similar enough, merge them
        if (similarity.similarityPercentage >= similarityThreshold) {
          // Decide which to keep (similar logic to mergeSnapshots)
          let keepFirst = true;

          if (snapshot2.isStarred && !snapshot1.isStarred) {
            keepFirst = false;
          } else if (snapshot2.customName && !snapshot1.customName) {
            keepFirst = false;
          } else if (snapshot2.tabs.length > snapshot1.tabs.length) {
            keepFirst = false;
          }

          if (keepFirst) {
            // Keep snapshot1, merge snapshot2 into it
            snapshots[id1] = {
              ...snapshot1,
              timestamp: Math.max(snapshot1.timestamp, snapshot2.timestamp),
              isStarred: snapshot1.isStarred || snapshot2.isStarred,
              customName: snapshot1.customName || snapshot2.customName,
            };

            // Remove snapshot2
            delete snapshots[id2];

            // Track the mapping
            idMappings[id2] = id1;

            console.log(
              `Deduplicated: Merged snapshot ${id2} into ${id1} (${similarity.similarityPercentage.toFixed(
                2
              )}% similarity)`
            );
          } else {
            // Keep snapshot2, merge snapshot1 into it
            snapshots[id2] = {
              ...snapshot2,
              timestamp: Math.max(snapshot1.timestamp, snapshot2.timestamp),
              isStarred: snapshot2.isStarred || snapshot1.isStarred,
              customName: snapshot2.customName || snapshot1.customName,
            };

            // Remove snapshot1
            delete snapshots[id1];

            // Track the mapping
            idMappings[id1] = id2;

            console.log(
              `Deduplicated: Merged snapshot ${id1} into ${id2} (${similarity.similarityPercentage.toFixed(
                2
              )}% similarity)`
            );

            // Since we're removing snapshot1, we need to break and move to the next i
            break;
          }

          mergeCount++;
        }
      }
    }

    if (mergeCount > 0) {
      // Save the updated snapshots
      await saveAllSnapshots(snapshots);

      // Update window ID mappings for any merged snapshots
      if (Object.keys(idMappings).length > 0) {
        // Get current window ID map
        const idMap = await getWindowIdMap();
        let updatedMap = false;

        // For each browser window, check if its oopsWindowId was merged
        for (const [windowIdStr, oopsWindowId] of Object.entries(idMap)) {
          const mergedInto = idMappings[oopsWindowId];
          if (mergedInto) {
            // Update the mapping to point to the snapshot it was merged into
            idMap[parseInt(windowIdStr, 10)] = mergedInto;
            updatedMap = true;
            console.log(
              `Updated window ${windowIdStr} mapping to point to merged snapshot ${mergedInto}`
            );
          }
        }

        // Save the updated mappings if changed
        if (updatedMap) {
          await saveWindowIdMap(idMap);
        }
      }
    }

    return mergeCount;
  } catch (err) {
    console.error("Error deduplicating snapshots:", err);
    return 0;
  }
};
