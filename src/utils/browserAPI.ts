/**
 * Browser API Utility
 *
 * Provides a consistent browser API interface for cross-browser compatibility
 * using the webextension-polyfill.
 */

import browserPolyfill from "webextension-polyfill";
import { BrowserInfo } from "../types";

// For Chrome and other browsers that support the webextension standard
const api = browserPolyfill;

// Initialize browser info with default values
const browserInfo: BrowserInfo = {
  isChrome: false,
  isFirefox: false,
  supportsTabGroups: false,
};

// Initialize browser detection
const detectBrowser = async () => {
  try {
    // Use user agent and feature detection instead of Firefox-specific API
    const userAgent = navigator.userAgent.toLowerCase();

    // Detect Firefox
    browserInfo.isFirefox = userAgent.includes("firefox");

    // Detect Chrome (includes Chrome, Edge, Opera, etc. that use Chromium)
    browserInfo.isChrome =
      userAgent.includes("chrome") || userAgent.includes("chromium");

    // Feature detection
    browserInfo.supportsTabGroups = typeof api.tabGroups !== "undefined";

    console.log(
      `Browser detected: ${
        browserInfo.isFirefox
          ? "Firefox"
          : browserInfo.isChrome
          ? "Chrome"
          : "Unknown"
      }`
    );
    console.log(`Tab Groups API supported: ${browserInfo.supportsTabGroups}`);
  } catch (err) {
    console.error("Error detecting browser:", err);
  }
};

// Call the detection function when this module is loaded
detectBrowser();

// Exporting the browser API and detection results
export default api;
export const { isChrome, isFirefox, supportsTabGroups } = browserInfo;
