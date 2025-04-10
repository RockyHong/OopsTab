import React, { useState, useEffect } from "react";
import {
  Typography,
  Card,
  Button,
  IconButton,
  Toggle,
  ListItem,
} from "../../components/ui";
import {
  CogIcon,
  ArrowPathIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowPathRoundedSquareIcon,
  BeakerIcon,
} from "@heroicons/react/24/solid";
import {
  getAllSnapshots,
  WindowEntry,
  WindowSnapshot,
  restoreSession,
  deleteSnapshot,
  setupDebugActions,
  clearAllData,
  createTestWindow,
  logStorageState,
} from "../../utils";

// Helper to format date
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

const OopsTab: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Set up debug functionality when component mounts
  useEffect(() => {
    setupDebugActions();
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Typography variant="h1" className="text-primary">
            OopsTab
          </Typography>
          <div className="flex space-x-2">
            <IconButton
              size="md"
              onClick={() => {
                setShowSettings(false);
                setShowDebug(!showDebug);
              }}
              aria-label="Debug"
              className={showDebug ? "bg-yellow-500 text-white" : ""}
            >
              <BeakerIcon className="h-5 w-5" />
            </IconButton>
            <IconButton
              size="md"
              onClick={() => {
                setShowDebug(false);
                setShowSettings(!showSettings);
              }}
              aria-label="Settings"
              className={showSettings ? "bg-primary text-white" : ""}
            >
              <CogIcon className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {showSettings ? (
          <SettingsPanel />
        ) : showDebug ? (
          <DebugPanel />
        ) : (
          <SnapshotsPanel />
        )}
      </main>
    </div>
  );
};

const SnapshotsPanel: React.FC = () => {
  const [windowEntries, setWindowEntries] = useState<WindowEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load snapshots
  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const snapshots = await getAllSnapshots();
      setWindowEntries(snapshots);
    } catch (err) {
      console.error("Error loading snapshots:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
  }, []);

  // Handle snapshot restoration
  const handleRestore = async (
    oopsWindowId: string,
    snapshot: WindowSnapshot
  ) => {
    try {
      const success = await restoreSession(oopsWindowId, snapshot);
      if (success) {
        console.log(`Successfully restored window ${oopsWindowId}`);
      } else {
        console.error(`Failed to restore window ${oopsWindowId}`);
      }
    } catch (err) {
      console.error("Error restoring window:", err);
    }
  };

  // Handle snapshot deletion
  const handleDelete = async (oopsWindowId: string, timestamp: number) => {
    if (!confirm("Are you sure you want to delete this snapshot?")) return;

    try {
      const success = await deleteSnapshot(oopsWindowId, timestamp);
      if (success) {
        console.log(
          `Successfully deleted snapshot ${timestamp} from window ${oopsWindowId}`
        );
        // Refresh the list
        loadSnapshots();
      } else {
        console.error(
          `Failed to delete snapshot ${timestamp} from window ${oopsWindowId}`
        );
      }
    } catch (err) {
      console.error("Error deleting snapshot:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Typography variant="h2">Tab Snapshots</Typography>
        <Button
          variant="primary"
          size="md"
          onClick={loadSnapshots}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Refresh Snapshots"}
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-5 flex justify-center items-center">
          <Typography variant="body">Loading snapshots...</Typography>
        </Card>
      ) : windowEntries.length === 0 ? (
        <Card className="p-5">
          <Typography variant="body">
            No snapshots available. Open some windows and tabs to create
            snapshots.
          </Typography>
        </Card>
      ) : (
        <>
          {windowEntries.map((entry) => (
            <div key={entry.oopsWindowId} className="mb-4">
              <Typography variant="h2" className="mb-2">
                Window ID: {entry.oopsWindowId.slice(0, 8)}...
              </Typography>
              <Card className="p-0 overflow-hidden">
                {entry.snapshots.length > 0 ? (
                  entry.snapshots.map((snapshot) => {
                    // Get the first few tab titles for display
                    const tabTitles = snapshot.tabs
                      .slice(0, 3)
                      .map((tab) => tab.title || tab.url)
                      .filter(Boolean);

                    const subtitle =
                      tabTitles.length > 0
                        ? `${tabTitles[0]}${
                            tabTitles.length > 1
                              ? ` and ${tabTitles.length - 1} more`
                              : ""
                          }`
                        : "No tabs";

                    // Get favicon for display if available (use first tab's favicon)
                    const firstTabWithFavicon = snapshot.tabs.find(
                      (tab) => tab.faviconUrl
                    );
                    const icon = firstTabWithFavicon?.faviconUrl ? (
                      <img
                        src={firstTabWithFavicon.faviconUrl}
                        className="h-5 w-5"
                        alt="Tab favicon"
                        onError={(e) => {
                          // Fallback if favicon fails to load
                          e.currentTarget.src = "";
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <DocumentDuplicateIcon className="h-5 w-5" />
                    );

                    return (
                      <ListItem
                        key={snapshot.timestamp}
                        title={`${snapshot.tabs.length} tab${
                          snapshot.tabs.length !== 1 ? "s" : ""
                        }`}
                        subtitle={subtitle}
                        metadata={formatDate(snapshot.timestamp)}
                        icon={icon}
                        actions={
                          <div className="flex space-x-1">
                            <IconButton
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                handleRestore(entry.oopsWindowId, snapshot)
                              }
                            >
                              <ArrowPathRoundedSquareIcon className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              size="sm"
                              variant="danger"
                              onClick={() =>
                                handleDelete(
                                  entry.oopsWindowId,
                                  snapshot.timestamp
                                )
                              }
                            >
                              <TrashIcon className="h-4 w-4" />
                            </IconButton>
                          </div>
                        }
                      />
                    );
                  })
                ) : (
                  <div className="p-4">
                    <Typography variant="body">
                      No snapshots for this window
                    </Typography>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </>
      )}

      <div className="mt-8 flex justify-end space-x-3">
        <Button
          variant="passive"
          size="sm"
          onClick={loadSnapshots}
          disabled={isLoading}
        >
          <ArrowPathIcon className="h-4 w-4 mr-1 inline" />
          Refresh
        </Button>
      </div>
    </div>
  );
};

const SettingsPanel: React.FC = () => {
  const [autoSnapshot, setAutoSnapshot] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="space-y-6">
      <Typography variant="h2">Settings</Typography>

      <Card className="p-5">
        <div className="space-y-6">
          <div>
            <Typography variant="h2" className="mb-4">
              Preferences
            </Typography>
            <div className="space-y-4">
              <Toggle
                checked={autoSnapshot}
                onChange={setAutoSnapshot}
                label="Enable auto-snapshot"
              />

              <Toggle
                checked={darkMode}
                onChange={setDarkMode}
                label="Dark mode (coming soon)"
                disabled={true}
              />
            </div>
          </div>

          <div>
            <Typography variant="h2" className="mb-4">
              About
            </Typography>
            <Typography variant="body">
              OopsTab helps you manage browser tabs with snapshots for quick
              recovery.
            </Typography>
          </div>

          <div className="pt-4 flex justify-between">
            <Button variant="primary">Save Settings</Button>
            <Button variant="danger" size="sm">
              Reset Defaults
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const DebugPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Typography variant="h2">Debug Panel</Typography>
        <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm">
          Developer Tools
        </div>
      </div>

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

export default OopsTab;
