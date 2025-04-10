/**
 * Browser API Utility
 *
 * Provides a consistent browser API interface for cross-browser compatibility
 * using the webextension-polyfill.
 */

import browserPolyfill from "webextension-polyfill";

// For Chrome and other browsers that support the webextension standard
const api = browserPolyfill;

// Detect browser type
let isChrome = false;
let isFirefox = false;

// Feature detection for specific browser features
let supportsTabGroups = false;

// Initialize browser detection
const detectBrowser = async () => {
  try {
    // Check if we're in Firefox by using Firefox-specific API
    const browserInfo = await api.runtime.getBrowserInfo().catch(() => null);
    isFirefox = Boolean(browserInfo && browserInfo.name === "Firefox");

    // If not Firefox, Chrome is a reasonable assumption for now
    // This can be expanded later for Edge, Safari, etc.
    isChrome = !isFirefox;

    // Feature detection
    supportsTabGroups = typeof api.tabGroups !== "undefined";

    console.log(
      `Browser detected: ${
        isFirefox ? "Firefox" : isChrome ? "Chrome" : "Unknown"
      }`
    );
    console.log(`Tab Groups API supported: ${supportsTabGroups}`);
  } catch (err) {
    console.error("Error detecting browser:", err);
  }
};

// Call the detection function when this module is loaded
detectBrowser();

// Exporting the browser API and detection results
export default api;
export { isChrome, isFirefox, supportsTabGroups };
