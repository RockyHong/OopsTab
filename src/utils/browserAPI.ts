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
    // Use user agent and feature detection instead of Firefox-specific API
    const userAgent = navigator.userAgent.toLowerCase();

    // Detect Firefox
    isFirefox = userAgent.includes("firefox");

    // Detect Chrome (includes Chrome, Edge, Opera, etc. that use Chromium)
    isChrome = userAgent.includes("chrome") || userAgent.includes("chromium");

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
