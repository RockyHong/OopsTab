import React, { useState, useEffect } from "react";
import { Typography, Card, Button } from "../../components/ui";
import {
  getStorageStats,
  updateStorageStats,
  StorageStats,
  setupDebugActions,
  clearAllData,
  createTestWindow,
  createBulkTestSnapshots,
  logStorageState,
} from "../../utils";

// Helper to format date (copied from OopsTab to keep the component self-contained)
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  );

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60)
    return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24)
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
};

/**
 * Debug Panel Component
 * Only available in development mode
 */
const DebugPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [bulkTestParams, setBulkTestParams] = useState({
    count: 20,
    windows: 3,
    tabsPerSnapshot: 5,
  });

  // Set up debug functionality when component mounts
  useEffect(() => {
    setupDebugActions();
  }, []);

  // Load storage stats
  const loadStorageStats = async () => {
    setIsLoading(true);
    try {
      await updateStorageStats();
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (err) {
      console.error("Error loading storage stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load stats on mount
  useEffect(() => {
    loadStorageStats();
  }, []);

  const handleCreateTestWindow = async () => {
    setIsLoading(true);
    setStatusMessage("Creating test window...");

    try {
      const windowId = await createTestWindow(5, true);
      if (windowId) {
        setStatusMessage(`Test window created with ID: ${windowId}`);
      } else {
        setStatusMessage("Failed to create test window");
      }
    } catch (err) {
      console.error("Error creating test window:", err);
      setStatusMessage("Error creating test window");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogStorage = async () => {
    setIsLoading(true);
    setStatusMessage("Logging storage state to console...");

    try {
      await logStorageState();
      setStatusMessage("Storage state logged to console. Press F12 to view.");
    } catch (err) {
      console.error("Error logging storage:", err);
      setStatusMessage("Error logging storage state");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = async () => {
    setIsLoading(true);
    setStatusMessage("Clearing all data...");

    try {
      await clearAllData();
      setStatusMessage("All data cleared successfully");
    } catch (err) {
      console.error("Error clearing data:", err);
      setStatusMessage("Error clearing data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBulkSnapshots = async () => {
    setIsLoading(true);
    setStatusMessage(`Creating ${bulkTestParams.count} test snapshots...`);

    try {
      const success = await createBulkTestSnapshots(
        bulkTestParams.count,
        bulkTestParams.windows,
        bulkTestParams.tabsPerSnapshot
      );
      if (success) {
        setStatusMessage(
          `Successfully created ${bulkTestParams.count} test snapshots across ${bulkTestParams.windows} windows`
        );
        // Refresh storage stats
        await loadStorageStats();
      } else {
        setStatusMessage("Failed to create bulk test snapshots");
      }
    } catch (err) {
      console.error("Error creating bulk test snapshots:", err);
      setStatusMessage("Error creating bulk test snapshots");
    } finally {
      setIsLoading(false);
    }
  };

  // Format bytes to human-readable format (KB, MB)
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Storage Statistics Card */}
      <Card className="p-5">
        <Typography variant="h2" className="mb-4">
          Storage Statistics
        </Typography>
        {storageStats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-md">
                <Typography variant="body" className="text-xs text-gray-500">
                  Total Storage Quota
                </Typography>
                <Typography variant="h2" className="text-lg">
                  {formatBytes(storageStats.totalBytes)}
                </Typography>
              </div>
              <div className="p-3 bg-gray-50 rounded-md">
                <Typography variant="body" className="text-xs text-gray-500">
                  Used Storage
                </Typography>
                <Typography variant="h2" className="text-lg">
                  {formatBytes(storageStats.usedBytes)}
                  <span className="text-sm text-gray-500 ml-1">
                    (
                    {(
                      (storageStats.usedBytes / storageStats.totalBytes) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </Typography>
              </div>
              <div className="p-3 bg-gray-50 rounded-md">
                <Typography variant="body" className="text-xs text-gray-500">
                  Total Windows
                </Typography>
                <Typography variant="h2" className="text-lg">
                  {storageStats.itemCounts.windows}
                </Typography>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Last updated: {formatDate(storageStats.lastUpdate)}
            </div>
            <Button variant="passive" size="sm" onClick={loadStorageStats}>
              Refresh Storage Stats
            </Button>
          </div>
        ) : (
          <div className="p-4 text-center">
            <Typography variant="body">
              Loading storage statistics...
            </Typography>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="space-y-6">
          <div>
            <Typography variant="h2" className="mb-4">
              Test Actions
            </Typography>
            <div className="space-y-4">
              <div className="flex space-x-4">
                <Button
                  variant="primary"
                  onClick={handleCreateTestWindow}
                  disabled={isLoading}
                >
                  Create Test Window
                </Button>
                <Button
                  variant="passive"
                  onClick={handleLogStorage}
                  disabled={isLoading}
                >
                  Log Storage State
                </Button>
                <Button
                  variant="danger"
                  onClick={handleClearData}
                  disabled={isLoading}
                >
                  Clear All Data
                </Button>
              </div>

              {/* Bulk Test Snapshots */}
              <div className="mt-4 p-4 border border-gray-200 rounded-md">
                <Typography variant="h2" className="text-base mb-3">
                  Stress Test - Create Bulk Snapshots
                </Typography>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Number of Snapshots
                    </label>
                    <input
                      type="number"
                      value={bulkTestParams.count}
                      onChange={(e) =>
                        setBulkTestParams((prev) => ({
                          ...prev,
                          count: Math.max(
                            1,
                            Math.min(100, parseInt(e.target.value) || 1)
                          ),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Number of Windows
                    </label>
                    <input
                      type="number"
                      value={bulkTestParams.windows}
                      onChange={(e) =>
                        setBulkTestParams((prev) => ({
                          ...prev,
                          windows: Math.max(
                            1,
                            Math.min(10, parseInt(e.target.value) || 1)
                          ),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Tabs Per Snapshot
                    </label>
                    <input
                      type="number"
                      value={bulkTestParams.tabsPerSnapshot}
                      onChange={(e) =>
                        setBulkTestParams((prev) => ({
                          ...prev,
                          tabsPerSnapshot: Math.max(
                            1,
                            Math.min(20, parseInt(e.target.value) || 1)
                          ),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="20"
                    />
                  </div>
                </div>
                <Typography
                  variant="body"
                  className="text-xs text-gray-500 mb-3"
                >
                  Warning: This will create a large number of test snapshots to
                  simulate heavy usage. Use this to test storage limits and
                  performance.
                </Typography>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateBulkSnapshots}
                  disabled={isLoading}
                >
                  Generate Test Snapshots
                </Button>
              </div>

              {statusMessage && (
                <div className="mt-4 p-3 bg-gray-100 rounded-md">
                  <Typography variant="body">{statusMessage}</Typography>
                </div>
              )}
            </div>
          </div>

          <div>
            <Typography variant="h2" className="mb-4">
              Console Shortcuts
            </Typography>
            <Typography variant="body">
              These functions are also available in the browser console under{" "}
              <code>window.oopsTab.debug</code>.
            </Typography>
            <ul className="list-disc pl-5 mt-2 text-sm text-gray-700">
              <li>logStorage() - Display storage diagnostics</li>
              <li>clearData() - Purge all extension data</li>
              <li>
                createTestWindow(tabCount, useGroups) - Create a window with
                test tabs
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DebugPanel;
