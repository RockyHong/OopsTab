import React, { useState, useEffect } from "react";
import {
  Typography,
  Card,
  Button,
  IconButton,
  Toggle,
  ListItem,
  Modal,
  StorageIndicator,
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
  saveSnapshot,
  renameSnapshot,
  getConfig,
  saveConfig,
  OopsConfig,
  DEFAULT_CONFIG,
  getStorageStats,
  updateStorageStats,
  checkStorageLimits,
  StorageStats,
  DEFAULT_STORAGE_STATS,
  setupDebugActions,
  clearAllData,
  createTestWindow,
  createBulkTestSnapshots,
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

// Confirmation Dialog component
const ConfirmationDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onConfirm();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <Typography variant="body">{message}</Typography>
        <div className="flex justify-end space-x-3 pt-2">
          <Button variant="passive" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} size="sm">
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const SnapshotsPanel: React.FC = () => {
  const [windowEntries, setWindowEntries] = useState<WindowEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageStatus, setStorageStatus] = useState({
    percentUsed: 0,
    isApproachingLimit: false,
    warningMessage: "",
    usedBytes: 0,
    totalBytes: DEFAULT_STORAGE_STATS.totalBytes,
  });

  // State for confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    windowId: "",
    timestamp: 0,
  });

  // Load storage status
  const loadStorageStatus = async () => {
    try {
      // Update storage stats first to ensure they're current
      await updateStorageStats();

      // Get limits check
      const limits = await checkStorageLimits();
      const stats = await getStorageStats();

      setStorageStatus({
        percentUsed: limits.percentUsed,
        isApproachingLimit: limits.isApproachingLimit,
        warningMessage: limits.warningMessage || "",
        usedBytes: stats.usedBytes,
        totalBytes: stats.totalBytes,
      });
    } catch (err) {
      console.error("Error checking storage status:", err);
    }
  };

  // Load snapshots
  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const snapshots = await getAllSnapshots();
      setWindowEntries(snapshots);

      // Also update storage status when loading snapshots
      await loadStorageStatus();
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
    // Open confirmation dialog instead of using browser's confirm
    setConfirmDialog({
      isOpen: true,
      windowId: oopsWindowId,
      timestamp,
    });
  };

  // Actual deletion after confirmation
  const confirmDelete = async () => {
    const { windowId, timestamp } = confirmDialog;

    try {
      const success = await deleteSnapshot(windowId, timestamp);
      if (success) {
        console.log(
          `Successfully deleted snapshot ${timestamp} from window ${windowId}`
        );
        // Refresh the list
        loadSnapshots();
      } else {
        console.error(
          `Failed to delete snapshot ${timestamp} from window ${windowId}`
        );
      }
    } catch (err) {
      console.error("Error deleting snapshot:", err);
    } finally {
      // Close the dialog
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Close the dialog without action
  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  // Handle saving a snapshot (promotion from auto-saved to saved)
  const handleSaveSnapshot = async (
    oopsWindowId: string,
    timestamp: number
  ) => {
    try {
      const success = await saveSnapshot(oopsWindowId, timestamp);
      if (success) {
        console.log(
          `Successfully saved snapshot ${timestamp} from window ${oopsWindowId}`
        );
        // Refresh the list
        loadSnapshots();
      } else {
        console.error(
          `Failed to save snapshot ${timestamp} from window ${oopsWindowId}`
        );
      }
    } catch (err) {
      console.error("Error saving snapshot:", err);
    }
  };

  // Component for editable snapshot names
  const EditableSnapshotName: React.FC<{
    oopsWindowId: string;
    snapshot: WindowSnapshot;
    onUpdate: () => void;
  }> = ({ oopsWindowId, snapshot, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(snapshot.customName || "");
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Generate default name if none exists
    const getDefaultName = () => {
      // If there's a custom name, use it
      if (snapshot.customName) return snapshot.customName;

      // Otherwise create one based on the first tab title and timestamp
      const firstTab = snapshot.tabs[0];
      const tabTitle = firstTab
        ? firstTab.title || firstTab.url || "Unnamed"
        : "Unnamed";
      const date = new Date(snapshot.timestamp);
      return `${tabTitle.slice(
        0,
        20
      )} - ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };

    // Handle rename submission
    const handleRename = async () => {
      if (name.trim() === "") {
        alert("Name cannot be empty");
        return;
      }

      try {
        const success = await renameSnapshot(
          oopsWindowId,
          snapshot.timestamp,
          name
        );
        if (success) {
          setIsEditing(false);
          onUpdate();
        }
      } catch (err) {
        console.error("Error renaming snapshot:", err);
      }
    };

    // Focus input when editing starts
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isEditing]);

    // Display name with edit option
    if (!snapshot.saved) {
      // For non-saved snapshots, just show the title
      return (
        <Typography
          variant="body"
          className="font-medium text-gray-900 truncate"
        >
          {snapshot.tabs.length} tab{snapshot.tabs.length !== 1 ? "s" : ""}
        </Typography>
      );
    }

    return isEditing ? (
      <div className="flex items-center space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") setIsEditing(false);
          }}
          className="px-2 py-1 border border-gray-300 rounded-md text-sm w-full"
          placeholder="Enter session name"
        />
        <IconButton
          size="sm"
          variant="primary"
          onClick={handleRename}
          title="Save name"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z"
              clipRule="evenodd"
            />
          </svg>
        </IconButton>
        <IconButton
          size="sm"
          variant="passive"
          onClick={() => setIsEditing(false)}
          title="Cancel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </IconButton>
      </div>
    ) : (
      <div className="flex items-center">
        <Typography
          variant="body"
          className="font-medium text-gray-900 truncate mr-2"
        >
          {snapshot.customName || getDefaultName()}
        </Typography>
        <IconButton
          size="sm"
          variant="passive"
          onClick={() => {
            setName(snapshot.customName || getDefaultName());
            setIsEditing(true);
          }}
          title="Edit name"
          className="opacity-50 hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-3 h-3"
          >
            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
          </svg>
        </IconButton>
      </div>
    );
  };

  // Render a snapshot list item
  const renderSnapshotItem = (
    entry: WindowEntry,
    snapshot: WindowSnapshot,
    isSaved: boolean
  ) => {
    // Get the first few tab titles for display
    const tabTitles = snapshot.tabs
      .slice(0, 3)
      .map((tab) => tab.title || tab.url)
      .filter(Boolean);

    const subtitle =
      tabTitles.length > 0
        ? `${tabTitles[0]}${
            tabTitles.length > 1 ? ` and ${tabTitles.length - 1} more` : ""
          }`
        : "No tabs";

    // Get favicon for display if available (use first tab's favicon)
    const firstTabWithFavicon = snapshot.tabs.find((tab) => tab.faviconUrl);
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
        title={
          <EditableSnapshotName
            oopsWindowId={entry.oopsWindowId}
            snapshot={snapshot}
            onUpdate={loadSnapshots}
          />
        }
        subtitle={subtitle}
        metadata={formatDate(snapshot.timestamp)}
        icon={icon}
        className={isSaved ? "border-l-4 border-primary" : ""}
        actions={
          <div className="flex space-x-1">
            {!isSaved && (
              <IconButton
                size="sm"
                variant="primary"
                onClick={() =>
                  handleSaveSnapshot(entry.oopsWindowId, snapshot.timestamp)
                }
                title="Save this snapshot"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M3 3a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 3v14.25a2.25 2.25 0 0 1-2.25 2.25h-13.5A2.25 2.25 0 0 1 3 17.25V3Z" />
                  <path d="M7.5 15.75v-6a.75.75 0 0 1 1.5 0v6a.75.75 0 0 1-1.5 0ZM15 15.75v-6a.75.75 0 0 1 1.5 0v6a.75.75 0 0 1-1.5 0Z" />
                </svg>
              </IconButton>
            )}
            <IconButton
              size="sm"
              variant="primary"
              onClick={() => handleRestore(entry.oopsWindowId, snapshot)}
              title="Restore session"
            >
              <ArrowPathRoundedSquareIcon className="h-4 w-4" />
            </IconButton>
            <IconButton
              size="sm"
              variant="danger"
              onClick={() =>
                handleDelete(entry.oopsWindowId, snapshot.timestamp)
              }
              title="Delete snapshot"
            >
              <TrashIcon className="h-4 w-4" />
            </IconButton>
          </div>
        }
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Storage indicator */}
      <Card className="p-4">
        <StorageIndicator
          percentUsed={storageStatus.percentUsed}
          isApproachingLimit={storageStatus.isApproachingLimit}
          warningMessage={storageStatus.warningMessage}
          usedBytes={storageStatus.usedBytes}
          totalBytes={storageStatus.totalBytes}
        />
        <div className="mt-3 flex justify-between text-xs text-gray-500">
          <div>
            Windows: {storageStatus.usedBytes > 0 ? windowEntries.length : 0}
          </div>
          <div>
            Snapshots:{" "}
            {storageStatus.usedBytes > 0
              ? windowEntries.reduce(
                  (acc, entry) => acc + entry.snapshots.length,
                  0
                )
              : 0}
          </div>
          <div>
            Last updated:{" "}
            {storageStatus.usedBytes > 0 ? formatDate(Date.now()) : "Never"}
          </div>
        </div>
      </Card>

      {/* Auto-saved Snapshots */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h2">Auto-saved Snapshots</Typography>
          <Button
            variant="primary"
            size="sm"
            onClick={loadSnapshots}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Refresh"}
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
            {windowEntries.map((entry) => {
              // Filter for auto-saved (not saved) snapshots
              const autoSnapshots = entry.snapshots.filter(
                (snapshot) => !snapshot.saved
              );

              if (autoSnapshots.length === 0) return null;

              return (
                <div key={`auto-${entry.oopsWindowId}`} className="mb-4">
                  <Typography variant="h2" className="mb-2">
                    Window ID: {entry.oopsWindowId.slice(0, 8)}...
                  </Typography>
                  <Card className="p-0 overflow-hidden">
                    {autoSnapshots.map((snapshot) =>
                      renderSnapshotItem(entry, snapshot, false)
                    )}
                  </Card>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Saved Snapshots */}
      <div>
        <Typography variant="h2" className="mb-4">
          Saved Sessions
        </Typography>

        {isLoading ? (
          <Card className="p-5 flex justify-center items-center">
            <Typography variant="body">Loading saved sessions...</Typography>
          </Card>
        ) : (
          <>
            {windowEntries.some((entry) =>
              entry.snapshots.some((snapshot) => snapshot.saved)
            ) ? (
              windowEntries.map((entry) => {
                // Filter for saved snapshots
                const savedSnapshots = entry.snapshots.filter(
                  (snapshot) => snapshot.saved
                );

                if (savedSnapshots.length === 0) return null;

                return (
                  <div key={`saved-${entry.oopsWindowId}`} className="mb-4">
                    <Typography variant="h2" className="mb-2">
                      Window ID: {entry.oopsWindowId.slice(0, 8)}...
                    </Typography>
                    <Card className="p-0 overflow-hidden bg-gray-50">
                      {savedSnapshots.map((snapshot) =>
                        renderSnapshotItem(entry, snapshot, true)
                      )}
                    </Card>
                  </div>
                );
              })
            ) : (
              <Card className="p-5">
                <Typography variant="body">
                  No saved sessions yet. Click the Save button on an auto-saved
                  snapshot to save it.
                </Typography>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={confirmDelete}
        title="Delete Snapshot"
        message="Are you sure you want to delete this snapshot? This action cannot be undone."
      />
    </div>
  );
};

const SettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<OopsConfig>({ ...DEFAULT_CONFIG });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [storageStatus, setStorageStatus] = useState({
    percentUsed: 0,
    isApproachingLimit: false,
    warningMessage: "",
    usedBytes: 0,
    totalBytes: DEFAULT_STORAGE_STATS.totalBytes,
    itemCounts: {
      snapshots: 0,
      windows: 0,
      savedSnapshots: 0,
    },
  });

  // Load configuration and storage status on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load config
        const loadedConfig = await getConfig();
        setConfig(loadedConfig);

        // Update and load storage stats
        await updateStorageStats();
        const limits = await checkStorageLimits();
        const stats = await getStorageStats();

        setStorageStatus({
          percentUsed: limits.percentUsed,
          isApproachingLimit: limits.isApproachingLimit,
          warningMessage: limits.warningMessage || "",
          usedBytes: stats.usedBytes,
          totalBytes: stats.totalBytes,
          itemCounts: stats.itemCounts,
        });
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle saving config
  const saveSettings = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      await saveConfig(config);
      setStatusMessage("Settings saved successfully!");
    } catch (err) {
      console.error("Error saving config:", err);
      setStatusMessage("Error saving settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const resetDefaults = () => {
    if (window.confirm("Reset all settings to default values?")) {
      setConfig({ ...DEFAULT_CONFIG });
    }
  };

  // Handle input changes with validation
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof OopsConfig,
    min: number,
    max: number
  ) => {
    const value = parseInt(e.target.value, 10);

    if (isNaN(value)) return;

    // Clamp to min/max
    const clampedValue = Math.min(Math.max(value, min), max);

    setConfig((prev) => ({
      ...prev,
      [field]: clampedValue,
    }));
  };

  return (
    <div className="space-y-6">
      <Typography variant="h2">Settings</Typography>

      {/* Storage Management Card */}
      <Card className="p-5">
        <Typography variant="h2" className="mb-4">
          Storage Management
        </Typography>

        {isLoading ? (
          <div className="p-4 text-center">
            <Typography variant="body">
              Loading storage information...
            </Typography>
          </div>
        ) : (
          <div className="space-y-5">
            <StorageIndicator
              percentUsed={storageStatus.percentUsed}
              isApproachingLimit={storageStatus.isApproachingLimit}
              warningMessage={storageStatus.warningMessage}
              usedBytes={storageStatus.usedBytes}
              totalBytes={storageStatus.totalBytes}
            />

            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded-md text-center">
                <div className="text-xl font-semibold text-primary">
                  {storageStatus.itemCounts.windows}
                </div>
                <div className="text-xs text-gray-500">Windows</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md text-center">
                <div className="text-xl font-semibold text-primary">
                  {storageStatus.itemCounts.snapshots}
                </div>
                <div className="text-xs text-gray-500">Total Snapshots</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md text-center">
                <div className="text-xl font-semibold text-primary">
                  {storageStatus.itemCounts.savedSnapshots}
                </div>
                <div className="text-xs text-gray-500">Saved Sessions</div>
              </div>
            </div>

            <div className="text-sm text-gray-600 mt-4">
              <p>
                OopsTab stores your snapshots in browser storage, which has
                limited space. Manage your saved sessions carefully to avoid
                running out of space.
              </p>
              <ul className="list-disc pl-5 mt-2 text-xs text-gray-500">
                <li>
                  Auto-saved snapshots are automatically pruned based on your
                  settings
                </li>
                <li>Saved sessions remain until you manually delete them</li>
                <li>
                  If storage usage is high, consider deleting old saved sessions
                </li>
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* Snapshot Settings Card */}
      <Card className="p-5">
        <div className="space-y-6">
          <div>
            <Typography variant="h2" className="mb-4">
              Snapshot Settings
            </Typography>

            {isLoading ? (
              <div className="p-4 text-center">
                <Typography variant="body">Loading settings...</Typography>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="autosaveDebounce"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Autosave Debounce (ms)
                  </label>
                  <div className="flex items-center">
                    <input
                      id="autosaveDebounce"
                      type="number"
                      value={config.autosaveDebounce}
                      onChange={(e) =>
                        handleInputChange(e, "autosaveDebounce", 1000, 60000)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                      min="1000"
                      max="60000"
                      step="1000"
                    />
                    <div className="ml-2 text-sm text-gray-500">
                      {(config.autosaveDebounce / 1000).toFixed(1)}s
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Time to wait after tab changes before creating an
                    auto-snapshot (1-60 seconds)
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="maxSnapshotsPerWindow"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Max Auto-Snapshots Per Window
                  </label>
                  <input
                    id="maxSnapshotsPerWindow"
                    type="number"
                    value={config.maxSnapshotsPerWindow}
                    onChange={(e) =>
                      handleInputChange(e, "maxSnapshotsPerWindow", 1, 20)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    min="1"
                    max="20"
                  />
                  <p className="text-xs text-gray-500">
                    Number of automatic snapshots to keep for each window (1-20)
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="autoDeleteTTL"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Auto-delete Old Snapshots After (days)
                  </label>
                  <input
                    id="autoDeleteTTL"
                    type="number"
                    value={Math.round(
                      config.autoDeleteTTL / (24 * 60 * 60 * 1000)
                    )}
                    onChange={(e) =>
                      handleInputChange(
                        e,
                        "autoDeleteTTL",
                        0,
                        90 * 24 * 60 * 60 * 1000
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    min="0"
                    max="90"
                  />
                  <p className="text-xs text-gray-500">
                    Days to keep auto-saved snapshots (0 = never delete, max 90
                    days)
                  </p>
                </div>

                {statusMessage && (
                  <div
                    className={`p-2 rounded-md text-sm ${
                      statusMessage.includes("Error")
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {statusMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-between">
            <Button
              variant="primary"
              onClick={saveSettings}
              disabled={isSaving || isLoading}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={resetDefaults}
              disabled={isLoading}
            >
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
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [bulkTestParams, setBulkTestParams] = useState({
    count: 20,
    windows: 3,
    tabsPerSnapshot: 5,
  });

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
      <div className="flex items-center justify-between">
        <Typography variant="h2">Debug Panel</Typography>
        <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm">
          Developer Tools
        </div>
      </div>

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
              <div className="p-3 bg-gray-50 rounded-md">
                <Typography variant="body" className="text-xs text-gray-500">
                  Total Snapshots
                </Typography>
                <Typography variant="h2" className="text-lg">
                  {storageStats.itemCounts.snapshots}
                  <span className="text-sm text-gray-500 ml-1">
                    ({storageStats.itemCounts.savedSnapshots} saved)
                  </span>
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

export default OopsTab;
