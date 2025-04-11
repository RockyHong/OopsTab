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
const DELETE_UNDO_BUFFER_KEY = "oopsDeleteUndoBuffer";
const MAX_AUTO_SNAPSHOTS = 5; // Maximum auto-snapshots per window
const DEFAULT_STORAGE_QUOTA = 5 * 1024 * 1024; // 5MB default quota

// Storage statistics interface
export interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  lastUpdate: number;
  itemCounts: {
    snapshots: number;
    windows: number;
    savedSnapshots: number;
  };
}

// Default storage stats
export const DEFAULT_STORAGE_STATS: StorageStats = {
  totalBytes: DEFAULT_STORAGE_QUOTA,
  usedBytes: 0,
  lastUpdate: 0,
  itemCounts: {
    snapshots: 0,
    windows: 0,
    savedSnapshots: 0,
  },
};

// Default configuration
export interface OopsConfig {
  autosaveDebounce: number; // milliseconds
  maxSnapshotsPerWindow: number;
  autoDeleteTTL: number; // milliseconds (0 = no auto-delete)
}

export const DEFAULT_CONFIG: OopsConfig = {
  autosaveDebounce: 5000, // 5 seconds
  maxSnapshotsPerWindow: 5,
  autoDeleteTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
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
  saved?: boolean; // Flag to indicate if this is a manually saved snapshot
  customName?: string; // Custom name for the snapshot when saved
  tags?: string[]; // Array of tag strings for the snapshot
  starred?: boolean; // Flag to indicate if this snapshot is starred/favorite
}

export interface WindowEntry {
  oopsWindowId: string;
  snapshots: WindowSnapshot[];
}

/**
 * Structure for storing deleted snapshots that can be restored
 */
export interface DeletedSnapshot {
  oopsWindowId: string;
  snapshot: WindowSnapshot;
  deletedAt: number;
  expiresAt: number;
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
      maxSnapshotsPerWindow:
        config.maxSnapshotsPerWindow ?? DEFAULT_CONFIG.maxSnapshotsPerWindow,
      autoDeleteTTL: config.autoDeleteTTL ?? DEFAULT_CONFIG.autoDeleteTTL,
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
 * @returns Promise resolving to all window entries
 */
export const getAllSnapshots = async (): Promise<WindowEntry[]> => {
  const result = await browser.storage.local.get([SNAPSHOTS_KEY]);
  return Array.isArray(result[SNAPSHOTS_KEY]) ? result[SNAPSHOTS_KEY] : [];
};

/**
 * Save snapshots to storage
 * @param entries Window entries to save
 */
export const saveAllSnapshots = async (
  entries: WindowEntry[]
): Promise<void> => {
  await browser.storage.local.set({ [SNAPSHOTS_KEY]: entries });
  console.log("Snapshots saved:", entries);

  // Update storage statistics after saving
  await updateStorageStats();
};

/**
 * Find window entry by oopsWindowId
 * @param entries The array of window entries
 * @param oopsWindowId The oopsWindowId to find
 * @returns The window entry or undefined if not found
 */
const findWindowEntry = (
  entries: WindowEntry[],
  oopsWindowId: string
): WindowEntry | undefined => {
  return entries.find((entry) => entry.oopsWindowId === oopsWindowId);
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
 * @param windowId Chrome window ID to snapshot
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
    const entries = await getAllSnapshots();
    let entry = findWindowEntry(entries, oopsWindowId);

    if (!entry) {
      // Create new entry for this window
      entry = {
        oopsWindowId,
        snapshots: [],
      };
      entries.push(entry);
    }

    // Get user configuration
    const config = await getConfig();
    const maxSnapshots = config.maxSnapshotsPerWindow;

    // Add new snapshot
    entry.snapshots.unshift(snapshot);

    // Clean up old auto-saved snapshots if we have too many
    const autoSnapshots = entry.snapshots.filter((s) => !s.saved);
    if (autoSnapshots.length > maxSnapshots) {
      // Find auto snapshots to remove (keeping manually saved ones)
      const toRemove = autoSnapshots.slice(maxSnapshots);
      entry.snapshots = entry.snapshots.filter(
        (s) => s.saved || !toRemove.includes(s)
      );
    }

    // Apply TTL for auto-delete of old snapshots
    if (config.autoDeleteTTL > 0) {
      const cutoffTime = Date.now() - config.autoDeleteTTL;
      // Remove old auto-saved snapshots (keeping manually saved ones)
      entry.snapshots = entry.snapshots.filter(
        (s) => s.saved || s.timestamp >= cutoffTime
      );
    }

    // Save back to storage
    await saveAllSnapshots(entries);

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
 * Get snapshots for a specific window by oopsWindowId
 * @param oopsWindowId The oopsWindowId to find snapshots for
 * @returns Promise resolving to an array of snapshots
 */
export const getWindowSnapshots = async (
  oopsWindowId: string
): Promise<WindowSnapshot[]> => {
  const allSnapshots = await getAllSnapshots();
  const windowEntry = findWindowEntry(allSnapshots, oopsWindowId);
  return windowEntry ? windowEntry.snapshots : [];
};

/**
 * Delete a snapshot for a specific window
 * @param oopsWindowId The oopsWindowId the snapshot belongs to
 * @param timestamp The timestamp of the snapshot to delete
 * @returns Promise resolving to true if deletion was successful
 */
export const deleteSnapshot = async (
  oopsWindowId: string,
  timestamp: number
): Promise<boolean> => {
  const allSnapshots = await getAllSnapshots();
  const windowEntry = findWindowEntry(allSnapshots, oopsWindowId);

  if (!windowEntry) return false;

  const initialLength = windowEntry.snapshots.length;
  windowEntry.snapshots = windowEntry.snapshots.filter(
    (snapshot) => snapshot.timestamp !== timestamp
  );

  if (windowEntry.snapshots.length === initialLength) return false;

  await saveAllSnapshots(allSnapshots);
  console.log(
    `Deleted snapshot with timestamp ${timestamp} from window ${oopsWindowId}`
  );
  return true;
};

/**
 * Mark a snapshot as saved (promoted from auto-saved)
 * @param oopsWindowId The oopsWindowId of the window
 * @param timestamp The timestamp of the snapshot to save
 * @returns Promise resolving to true if snapshot was saved
 */
export const saveSnapshot = async (
  oopsWindowId: string,
  timestamp: number
): Promise<boolean> => {
  try {
    // Get all snapshots
    const entries = await getAllSnapshots();

    // Find the window entry
    const windowEntry = entries.find(
      (entry) => entry.oopsWindowId === oopsWindowId
    );
    if (!windowEntry) {
      console.error(`No window entry found for ${oopsWindowId}`);
      return false;
    }

    // Find and update the snapshot
    const snapshot = windowEntry.snapshots.find(
      (s) => s.timestamp === timestamp
    );
    if (!snapshot) {
      console.error(`No snapshot found with timestamp ${timestamp}`);
      return false;
    }

    // Mark as saved
    snapshot.saved = true;

    // Save back to storage
    await saveAllSnapshots(entries);
    console.log(`Snapshot ${timestamp} marked as saved`);
    return true;
  } catch (err) {
    console.error("Error saving snapshot:", err);
    return false;
  }
};

/**
 * Rename a snapshot with a custom name
 * @param oopsWindowId The oopsWindowId of the window
 * @param timestamp The timestamp of the snapshot to rename
 * @param newName The new custom name for the snapshot
 * @returns Promise resolving to true if snapshot was renamed
 */
export const renameSnapshot = async (
  oopsWindowId: string,
  timestamp: number,
  newName: string
): Promise<boolean> => {
  try {
    // Get all snapshots
    const entries = await getAllSnapshots();

    // Find the window entry
    const windowEntry = entries.find(
      (entry) => entry.oopsWindowId === oopsWindowId
    );
    if (!windowEntry) {
      console.error(`No window entry found for ${oopsWindowId}`);
      return false;
    }

    // Find and update the snapshot
    const snapshot = windowEntry.snapshots.find(
      (s) => s.timestamp === timestamp
    );
    if (!snapshot) {
      console.error(`No snapshot found with timestamp ${timestamp}`);
      return false;
    }

    // Update name
    snapshot.customName = newName.trim();

    // Save back to storage
    await saveAllSnapshots(entries);
    console.log(`Snapshot ${timestamp} renamed to "${newName}"`);
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
        snapshots: stats.itemCounts?.snapshots || 0,
        windows: stats.itemCounts?.windows || 0,
        savedSnapshots: stats.itemCounts?.savedSnapshots || 0,
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
    // Get all entries
    const entries = await getAllSnapshots();

    // Calculate stats
    let totalSize = 0;
    let snapshotCount = 0;
    let savedCount = 0;

    entries.forEach((entry) => {
      entry.snapshots.forEach((snapshot) => {
        const snapshotSize = calculateSnapshotSize(snapshot);
        totalSize += snapshotSize;
        snapshotCount++;

        if (snapshot.saved) {
          savedCount++;
        }
      });
    });

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
        snapshots: snapshotCount,
        windows: entries.length,
        savedSnapshots: savedCount,
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
 * Star/favorite a snapshot
 * @param oopsWindowId Window ID containing the snapshot
 * @param timestamp Timestamp of the snapshot
 * @param isStarred Whether to star or unstar
 * @returns Promise resolving to true if successful, false otherwise
 */
export const starSnapshot = async (
  oopsWindowId: string,
  timestamp: number,
  isStarred: boolean = true
): Promise<boolean> => {
  try {
    const entries = await getAllSnapshots();
    const windowIndex = entries.findIndex(
      (entry) => entry.oopsWindowId === oopsWindowId
    );

    if (windowIndex === -1) {
      return false;
    }

    const snapshotIndex = entries[windowIndex].snapshots.findIndex(
      (snapshot) => snapshot.timestamp === timestamp
    );

    if (snapshotIndex === -1) {
      return false;
    }

    // If starring, ensure it's also saved
    if (isStarred && !entries[windowIndex].snapshots[snapshotIndex].saved) {
      entries[windowIndex].snapshots[snapshotIndex].saved = true;
    }

    // Update starred status
    entries[windowIndex].snapshots[snapshotIndex].starred = isStarred;

    // Save to storage
    await saveAllSnapshots(entries);
    return true;
  } catch (err) {
    console.error("Error starring snapshot:", err);
    return false;
  }
};

/**
 * Get all starred snapshots
 * @returns Promise resolving to array of window entries containing only starred snapshots
 */
export const getStarredSnapshots = async (): Promise<WindowEntry[]> => {
  try {
    const entries = await getAllSnapshots();

    // Filter to only include entries with starred snapshots
    return entries
      .map((entry) => {
        const starredSnapshots = entry.snapshots.filter(
          (snapshot) => snapshot.starred
        );

        if (starredSnapshots.length === 0) {
          return null;
        }

        return {
          oopsWindowId: entry.oopsWindowId,
          snapshots: starredSnapshots,
        };
      })
      .filter((entry): entry is WindowEntry => entry !== null);
  } catch (err) {
    console.error("Error getting starred snapshots:", err);
    return [];
  }
};

/**
 * Check if a snapshot is starred
 * @param oopsWindowId Window ID containing the snapshot
 * @param timestamp Timestamp of the snapshot
 * @returns Promise resolving to true if starred, false otherwise
 */
export const isSnapshotStarred = async (
  oopsWindowId: string,
  timestamp: number
): Promise<boolean> => {
  try {
    const entries = await getAllSnapshots();
    const windowEntry = entries.find(
      (entry) => entry.oopsWindowId === oopsWindowId
    );

    if (!windowEntry) {
      return false;
    }

    const snapshot = windowEntry.snapshots.find(
      (snapshot) => snapshot.timestamp === timestamp
    );

    return !!snapshot?.starred;
  } catch (err) {
    console.error("Error checking if snapshot is starred:", err);
    return false;
  }
};

/**
 * Delete a snapshot and add it to the undo buffer
 * @param oopsWindowId Window ID containing the snapshot
 * @param timestamp Timestamp of the snapshot
 * @param undoTimeoutMs How long the undo option should be available (ms)
 * @returns Promise resolving to true if deletion was successful
 */
export const deleteSnapshotWithUndo = async (
  oopsWindowId: string,
  timestamp: number,
  undoTimeoutMs: number = 30000 // Default: 30 seconds
): Promise<boolean> => {
  try {
    // Get all snapshots
    const entries = await getAllSnapshots();
    const windowIndex = entries.findIndex(
      (entry) => entry.oopsWindowId === oopsWindowId
    );

    if (windowIndex === -1) {
      return false;
    }

    // Find the snapshot
    const snapshotIndex = entries[windowIndex].snapshots.findIndex(
      (snapshot) => snapshot.timestamp === timestamp
    );

    if (snapshotIndex === -1) {
      return false;
    }

    // Store the snapshot in the undo buffer before deleting
    const snapshot = entries[windowIndex].snapshots[snapshotIndex];
    await addToUndoBuffer(oopsWindowId, snapshot, undoTimeoutMs);

    // Remove the snapshot from the list
    entries[windowIndex].snapshots.splice(snapshotIndex, 1);

    // If no snapshots left for this window, remove the whole entry
    if (entries[windowIndex].snapshots.length === 0) {
      entries.splice(windowIndex, 1);
    }

    // Save updated entries
    await saveAllSnapshots(entries);

    // Return success
    return true;
  } catch (err) {
    console.error("Error deleting snapshot with undo:", err);
    return false;
  }
};

/**
 * Add a deleted snapshot to the undo buffer
 * @param oopsWindowId Window ID the snapshot belonged to
 * @param snapshot The snapshot that was deleted
 * @param timeoutMs How long until the undo option expires
 */
export const addToUndoBuffer = async (
  oopsWindowId: string,
  snapshot: WindowSnapshot,
  timeoutMs: number
): Promise<void> => {
  try {
    // Get current undo buffer
    const result = await browser.storage.local.get([DELETE_UNDO_BUFFER_KEY]);
    const undoBuffer: DeletedSnapshot[] = Array.isArray(
      result[DELETE_UNDO_BUFFER_KEY]
    )
      ? result[DELETE_UNDO_BUFFER_KEY]
      : [];

    // Calculate expiration time
    const now = Date.now();
    const expiresAt = now + timeoutMs;

    // Add deleted snapshot to buffer
    undoBuffer.push({
      oopsWindowId,
      snapshot,
      deletedAt: now,
      expiresAt,
    });

    // Clean up expired items in the buffer
    const cleanBuffer = undoBuffer.filter((item) => item.expiresAt > now);

    // Save updated buffer
    await browser.storage.local.set({
      [DELETE_UNDO_BUFFER_KEY]: cleanBuffer,
    });
  } catch (err) {
    console.error("Error adding to undo buffer:", err);
  }
};

/**
 * Get all items in the delete undo buffer
 * @returns Promise resolving to array of deleted snapshots
 */
export const getUndoBuffer = async (): Promise<DeletedSnapshot[]> => {
  try {
    const result = await browser.storage.local.get([DELETE_UNDO_BUFFER_KEY]);
    const buffer: DeletedSnapshot[] = Array.isArray(
      result[DELETE_UNDO_BUFFER_KEY]
    )
      ? result[DELETE_UNDO_BUFFER_KEY]
      : [];

    // Clean expired items
    const now = Date.now();
    const validBuffer = buffer.filter((item) => item.expiresAt > now);

    // If we cleaned some expired items, update the storage
    if (validBuffer.length !== buffer.length) {
      await browser.storage.local.set({
        [DELETE_UNDO_BUFFER_KEY]: validBuffer,
      });
    }

    return validBuffer;
  } catch (err) {
    console.error("Error getting undo buffer:", err);
    return [];
  }
};

/**
 * Restore a deleted snapshot from the undo buffer
 * @param oopsWindowId Window ID the snapshot belonged to
 * @param timestamp Timestamp of the snapshot
 * @returns Promise resolving to true if restoration was successful
 */
export const undoDelete = async (
  oopsWindowId: string,
  timestamp: number
): Promise<boolean> => {
  try {
    // Get the undo buffer
    const buffer = await getUndoBuffer();

    // Find the deleted snapshot
    const deletedSnapshotIndex = buffer.findIndex(
      (item) =>
        item.oopsWindowId === oopsWindowId &&
        item.snapshot.timestamp === timestamp
    );

    if (deletedSnapshotIndex === -1) {
      return false;
    }

    // Get the deleted snapshot
    const deletedItem = buffer[deletedSnapshotIndex];

    // Get all snapshots
    const entries = await getAllSnapshots();
    const windowIndex = entries.findIndex(
      (entry) => entry.oopsWindowId === oopsWindowId
    );

    // Either find or create window entry
    if (windowIndex === -1) {
      // Create new window entry
      entries.push({
        oopsWindowId,
        snapshots: [deletedItem.snapshot],
      });
    } else {
      // Add to existing window entry
      entries[windowIndex].snapshots.push(deletedItem.snapshot);

      // Sort snapshots by timestamp
      entries[windowIndex].snapshots.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Save updated entries
    await saveAllSnapshots(entries);

    // Remove from undo buffer
    buffer.splice(deletedSnapshotIndex, 1);
    await browser.storage.local.set({
      [DELETE_UNDO_BUFFER_KEY]: buffer,
    });

    return true;
  } catch (err) {
    console.error("Error undoing delete:", err);
    return false;
  }
};
