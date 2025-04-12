/**
 * Storage Types for OopsTab
 * Contains all types related to browser storage and configuration
 */

// Storage statistics interface
export interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  lastUpdate: number;
  itemCounts: {
    windows: number;
  };
}

// Default storage stats constants
export const DEFAULT_STORAGE_QUOTA = 5 * 1024 * 1024; // 5MB default quota

export const DEFAULT_STORAGE_STATS: StorageStats = {
  totalBytes: DEFAULT_STORAGE_QUOTA,
  usedBytes: 0,
  lastUpdate: 0,
  itemCounts: {
    windows: 0,
  },
};

// Application configuration
export interface OopsConfig {
  autosaveDebounce: number; // milliseconds
}

export const DEFAULT_CONFIG: OopsConfig = {
  autosaveDebounce: 5000, // 5 seconds
};

// Storage keys
export const STORAGE_KEYS = {
  SNAPSHOTS_KEY: "oopsSnapshots",
  CONFIG_KEY: "oopsConfig",
  STORAGE_STATS_KEY: "oopsStorageStats",
  WINDOW_ID_MAP_KEY: "oopsWindowIdMap",
};
