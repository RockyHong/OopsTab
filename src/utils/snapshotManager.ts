/**
 * Snapshot Manager Utilities for OopsTab
 * Handles creating, storing, and retrieving window snapshots
 */

import { getOopsWindowId } from "./windowTracking";
import browser, { supportsTabGroups } from "./browserAPI";

// Storage keys
const SNAPSHOTS_KEY = "oopsSnapshots";
const MAX_AUTO_SNAPSHOTS = 5; // Maximum auto-snapshots per window

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
}

export interface WindowEntry {
  oopsWindowId: string;
  snapshots: WindowSnapshot[];
}

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
    const tabsData: TabData[] = tabs.map((tab) => ({
      id: tab.id || 0,
      url: tab.url || "",
      title: tab.title || "",
      pinned: tab.pinned || false,
      groupId: tab.groupId || -1, // -1 is the standard TAB_GROUP_ID_NONE
      index: tab.index,
      faviconUrl: tab.favIconUrl || "",
    }));

    // Filter out invalid tabs (missing URLs)
    const validTabs = tabsData.filter(
      (tab) => tab.url && tab.url.startsWith("http")
    );

    // Don't create snapshots if there are no valid tabs
    if (validTabs.length === 0) {
      console.log(`Skipping snapshot for window ${windowId} - no valid tabs`);
      return false;
    }

    // Create snapshot
    const snapshot: WindowSnapshot = {
      timestamp: Date.now(),
      tabs: validTabs,
      groups,
    };

    // Get existing snapshots
    const allSnapshots = await getAllSnapshots();
    let windowEntry = findWindowEntry(allSnapshots, oopsWindowId);

    if (!windowEntry) {
      // Create new entry for this window
      windowEntry = {
        oopsWindowId,
        snapshots: [snapshot],
      };
      allSnapshots.push(windowEntry);
    } else {
      // Add to existing window, maintaining max limit
      windowEntry.snapshots.unshift(snapshot);

      // Limit number of auto-snapshots per window
      if (windowEntry.snapshots.length > MAX_AUTO_SNAPSHOTS) {
        windowEntry.snapshots = windowEntry.snapshots.slice(
          0,
          MAX_AUTO_SNAPSHOTS
        );
      }
    }

    // Save updated snapshots
    await saveAllSnapshots(allSnapshots);
    console.log(
      `Created snapshot for window ${windowId} (${oopsWindowId}) with ${validTabs.length} tabs`
    );
    return true;
  } catch (err) {
    console.error("Error creating snapshot:", err);
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
