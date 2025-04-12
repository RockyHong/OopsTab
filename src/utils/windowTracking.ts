/**
 * Window tracking utilities for OopsTab
 * Handles generating and managing oopsWindowIds
 */

import browser from "./browserAPI";
import { WindowIdMap, STORAGE_KEYS } from "../types";

// Extract constants from STORAGE_KEYS
const { WINDOW_ID_MAP_KEY } = STORAGE_KEYS;

/**
 * Generate a UUID v4 for window identification
 * @returns A new UUID string
 */
export const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Get the current window ID mapping
 * @returns Promise resolving to the window ID map
 */
export const getWindowIdMap = async (): Promise<WindowIdMap> => {
  const result = await browser.storage.local.get([WINDOW_ID_MAP_KEY]);
  // Create an empty record if not found
  if (!result[WINDOW_ID_MAP_KEY]) {
    return {} as WindowIdMap;
  }
  return result[WINDOW_ID_MAP_KEY] as WindowIdMap;
};

/**
 * Save the window ID mapping to storage
 * @param idMap The window ID mapping to save
 */
export const saveWindowIdMap = async (idMap: WindowIdMap): Promise<void> => {
  await browser.storage.local.set({ [WINDOW_ID_MAP_KEY]: idMap });
  console.log("Window ID map saved:", idMap);
};

/**
 * Generate and register a new oopsWindowId for a window
 * @param windowId The window ID
 * @returns The generated oopsWindowId
 */
export const registerWindow = async (windowId: number): Promise<string> => {
  const idMap = await getWindowIdMap();

  // If this window already has an ID, return it
  if (idMap[windowId]) {
    return idMap[windowId];
  }

  // Generate a new ID for this window
  const oopsWindowId = generateUUID();
  idMap[windowId] = oopsWindowId;

  // Save the updated map
  await saveWindowIdMap(idMap);
  console.log(
    `Registered window ${windowId} with oopsWindowId ${oopsWindowId}`
  );

  return oopsWindowId;
};

/**
 * Get an oopsWindowId for a window ID
 * @param windowId The window ID
 * @returns Promise resolving to the oopsWindowId or null if not found
 */
export const getOopsWindowId = async (
  windowId: number
): Promise<string | null> => {
  const idMap = await getWindowIdMap();
  return idMap[windowId] || null;
};

/**
 * Find a window ID by its oopsWindowId
 * @param oopsWindowId The oopsWindowId to look for
 * @returns Promise resolving to the window ID or null if not found
 */
export const findWindowByOopsId = async (
  oopsWindowId: string
): Promise<number | null> => {
  const idMap = await getWindowIdMap();
  let staleEntries: number[] = [];

  // First find the window ID for this oopsWindowId
  for (const [windowIdStr, id] of Object.entries(idMap)) {
    if (id === oopsWindowId) {
      const windowId = parseInt(windowIdStr, 10);

      // Verify that this window still exists
      try {
        await browser.windows.get(windowId);
        return windowId; // Window exists, return the ID
      } catch (err) {
        console.log(
          `Window ${windowId} no longer exists, will remove from map`
        );
        staleEntries.push(windowId);
      }
    }
  }

  // Clean up any stale entries found
  if (staleEntries.length > 0) {
    const updatedMap: Record<number, string> = {};

    // Only keep non-stale entries
    for (const [windowIdStr, id] of Object.entries(idMap)) {
      const windowId = parseInt(windowIdStr, 10);
      if (!staleEntries.includes(windowId)) {
        updatedMap[windowId] = id;
      }
    }

    await saveWindowIdMap(updatedMap);
  }

  return null;
};

/**
 * Initialize window tracking on extension startup
 * Maps all existing windows to oopsWindowIds
 */
export const initializeWindowTracking = async (): Promise<void> => {
  // Get all open windows
  const windows = await browser.windows.getAll();
  const idMap = await getWindowIdMap();
  let updatedMap = false;

  // Register any windows that don't have an oopsWindowId
  for (const window of windows) {
    if (window.id && !idMap[window.id]) {
      const oopsWindowId = generateUUID();
      idMap[window.id] = oopsWindowId;
      updatedMap = true;
      console.log(
        `Initialized window ${window.id} with oopsWindowId ${oopsWindowId}`
      );
    }
  }

  // Save if we made any changes
  if (updatedMap) {
    await saveWindowIdMap(idMap);
  }

  console.log("Window tracking initialized");
};

/**
 * Check if a newly created window might be a reopened window from history
 * Compares URLs with existing snapshots to find matches
 * @param windowId The window ID to check
 * @returns Promise resolving to true if a match was found and associated
 */
export const checkForReopenedWindow = async (
  windowId: number
): Promise<boolean> => {
  try {
    // Get tabs from this window
    const tabs = await browser.tabs.query({ windowId });
    if (tabs.length === 0) return false;

    // We need to import the snapshot functions here
    // Using dynamic import to avoid circular dependencies
    const { getAllSnapshots } = await import("./snapshotManager");

    // Get all snapshots
    const snapshots = await getAllSnapshots();

    // Extract URLs from this window's tabs
    const windowUrls = new Set(tabs.map((tab) => tab.url || ""));

    // Find best matching snapshot
    let bestMatch = { oopsWindowId: "", matchPercentage: 0 };

    for (const [oopsWindowId, snapshot] of Object.entries(snapshots)) {
      if (!snapshot.tabs || snapshot.tabs.length === 0) continue;

      // Count matches
      const snapshotUrls = snapshot.tabs.map((tab) => tab.url);
      let matches = 0;

      for (const url of snapshotUrls) {
        if (windowUrls.has(url)) matches++;
      }

      // Calculate match percentage - use the smaller count as denominator for higher accuracy
      const matchPercentage =
        (matches / Math.min(windowUrls.size, snapshotUrls.length)) * 100;

      // Consider it a match if percentage is high enough (over 70%)
      if (matchPercentage > 70 && matchPercentage > bestMatch.matchPercentage) {
        bestMatch = { oopsWindowId, matchPercentage };
      }
    }

    // If we found a good match, update the window ID mapping
    if (bestMatch.matchPercentage > 0) {
      const idMap = await getWindowIdMap();

      // Check if the matched oopsWindowId is already associated with another window
      let alreadyMapped = false;
      for (const [existingWindowIdStr, existingOopsId] of Object.entries(
        idMap
      )) {
        if (existingOopsId === bestMatch.oopsWindowId) {
          const existingWindowId = parseInt(existingWindowIdStr, 10);

          // Check if the window still exists
          try {
            await browser.windows.get(existingWindowId);
            console.log(
              `The matched window ID ${bestMatch.oopsWindowId} is already associated with window ${existingWindowId}`
            );
            alreadyMapped = true;
            break;
          } catch (err) {
            // Window doesn't exist anymore, we can reuse the oopsWindowId
            console.log(
              `Window ${existingWindowId} no longer exists, can reuse oopsWindowId`
            );
          }
        }
      }

      // Only reassign if not already mapped to an active window
      if (!alreadyMapped) {
        idMap[windowId] = bestMatch.oopsWindowId;
        await saveWindowIdMap(idMap);
        console.log(
          `Associated window ${windowId} with existing oopsWindowId ${
            bestMatch.oopsWindowId
          } (${bestMatch.matchPercentage.toFixed(2)}% URL match)`
        );
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("Error checking for reopened window:", err);
    return false;
  }
};
