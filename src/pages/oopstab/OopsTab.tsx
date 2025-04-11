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
} from "../../utils";
import browser from "../../utils/browserAPI";

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
  // Open the extension's options page
  const openOptionsPage = () => {
    browser.runtime.openOptionsPage();
  };

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
              onClick={openOptionsPage}
              aria-label="Settings"
            >
              <CogIcon className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <SnapshotsPanel />
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

export default OopsTab;
