/**
 * Snapshot Types for OopsTab
 * Contains all types related to snapshots, tabs, and tab groups
 */

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
export type TabGroupColor =
  | "grey"
  | "blue"
  | "red"
  | "yellow"
  | "green"
  | "pink"
  | "purple"
  | "cyan"
  | string; // For future compatibility

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
  isStarred?: boolean; // Flag to mark starred snapshots
}

// New simplified interface - direct mapping of oopsWindowId to snapshot
export interface SnapshotMap {
  [oopsWindowId: string]: WindowSnapshot;
}

// Original tab data extracted from middleware tab
export interface OriginalTabData {
  url: string;
  title: string;
  faviconUrl?: string;
}
