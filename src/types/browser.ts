/**
 * Browser Types for OopsTab
 * Contains all types related to browser windows, tabs, and browser API wrappers
 */

// Type for window ID mapping
export interface WindowIdMap {
  [windowId: number]: string; // Maps Chrome window ID to OopsTab window ID
}

// Browser detection information
export interface BrowserInfo {
  isChrome: boolean;
  isFirefox: boolean;
  supportsTabGroups: boolean;
}

// Window specific metrics and information
export interface WindowMetrics {
  width: number;
  height: number;
  left?: number;
  top?: number;
}

// Window state for caching
export interface WindowStateCache {
  timestamp: number;
  tabsData: import("./snapshot").TabData[];
  groups: import("./snapshot").TabGroupData[];
  oopsWindowId: string | null;
}
