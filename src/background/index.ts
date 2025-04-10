// Background service worker for OopsTab
console.log("OopsTab background service worker initialized");

// Listen for browser events
chrome.tabs.onRemoved.addListener(
  (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
    console.log("Tab closed:", tabId);
    // Here we will snapshot the tab before it's completely closed
  }
);

// This will keep track of windows closing
chrome.windows.onRemoved.addListener((windowId: number) => {
  console.log("Window closed:", windowId);
  // Here we will snapshot all tabs in the window
});

// Example of using the storage API
chrome.storage.local.get(["snapshots"], (result: { snapshots?: any[] }) => {
  const snapshots = result.snapshots || [];
  console.log("Current snapshots:", snapshots);
});
