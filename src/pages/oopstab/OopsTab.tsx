import React, { useState, useEffect } from "react";
import {
  Typography,
  Card,
  Button,
  IconButton,
  ListItem,
  Modal,
} from "../../components/ui";
import {
  Cog6ToothIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
} from "@heroicons/react/24/solid";
import {
  getAllSnapshots,
  WindowSnapshot,
  restoreSession,
  deleteSnapshot,
  renameSnapshot,
  getStorageStats,
  updateStorageStats,
  checkStorageLimits,
  DEFAULT_STORAGE_STATS,
  SnapshotMap,
} from "../../utils";
import browser from "../../utils/browserAPI";

// Add TabData interface
interface TabData {
  id?: number;
  windowId?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  faviconUrl?: string;
  groupId?: number;
  index?: number;
}

// Add TabGroupData interface to match the one in utils
interface TabGroupData {
  id: number;
  title?: string;
  color?: string;
  collapsed?: boolean;
}

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
              <Cog6ToothIcon className="h-5 w-5" />
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
  const [snapshots, setSnapshots] = useState<SnapshotMap>({});
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
      const snapshotMap = await getAllSnapshots();
      setSnapshots(snapshotMap);

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

    // Set up listener for storage changes
    const handleStorageChanges = (changes: any, areaName: string) => {
      if (areaName === "local") {
        // Look for changes to the oopsSnapshots key
        if (changes.oopsSnapshots) {
          console.log("Snapshot storage changes detected, refreshing...");
          loadSnapshots();
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChanges);

    // Clean up listener on unmount
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChanges);
    };
  }, []);

  // Handle snapshot restoration
  const handleRestore = async (oopsWindowId: string) => {
    try {
      const success = await restoreSession(oopsWindowId);
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
  const handleDelete = async (oopsWindowId: string) => {
    // Open confirmation dialog instead of using browser's confirm
    setConfirmDialog({
      isOpen: true,
      windowId: oopsWindowId,
    });
  };

  // Actual deletion after confirmation
  const confirmDelete = async () => {
    const { windowId } = confirmDialog;

    try {
      const success = await deleteSnapshot(windowId);
      if (success) {
        console.log(`Successfully deleted snapshot for window ${windowId}`);
        // Refresh the list
        loadSnapshots();
      } else {
        console.error(`Failed to delete snapshot for window ${windowId}`);
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
      // Add defensive check for tabs
      if (
        !snapshot.tabs ||
        !Array.isArray(snapshot.tabs) ||
        snapshot.tabs.length === 0
      ) {
        return `Window Snapshot - ${new Date(
          snapshot.timestamp
        ).toLocaleDateString()}`;
      }

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
        const success = await renameSnapshot(oopsWindowId, name);
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
          <CheckIcon className="h-4 w-4" />
        </IconButton>
        <IconButton
          size="sm"
          variant="passive"
          onClick={() => setIsEditing(false)}
          title="Cancel"
        >
          <XMarkIcon className="h-4 w-4" />
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
          <PencilIcon className="h-3 w-3" />
        </IconButton>
      </div>
    );
  };

  // Render a snapshot list item
  const renderSnapshotItem = (
    oopsWindowId: string,
    snapshot: WindowSnapshot
  ) => {
    // Defensive check to make sure snapshot.tabs exists
    if (!snapshot || !snapshot.tabs || !Array.isArray(snapshot.tabs)) {
      return (
        <ListItem
          key={`${oopsWindowId}-error`}
          title="Error: Invalid snapshot data"
          subtitle="This snapshot appears to be corrupted"
          metadata={
            snapshot?.timestamp
              ? formatDate(snapshot.timestamp)
              : "Unknown time"
          }
          actions={
            <div className="flex space-x-1">
              <IconButton
                size="sm"
                variant="danger"
                onClick={() => handleDelete(oopsWindowId)}
                title="Delete snapshot"
              >
                <TrashIcon className="h-4 w-4" />
              </IconButton>
            </div>
          }
        />
      );
    }

    // Render the tab favicon list
    const renderTabFavicons = () => {
      // Get all tabs for display, limit to first 15
      const tabsToDisplay = snapshot.tabs
        .slice(0, 15)
        // Sort tabs by their original index to maintain window order
        .sort((a, b) => (a.index || 0) - (b.index || 0));

      const remainingCount = snapshot.tabs.length - tabsToDisplay.length;

      // Create a map for quick group lookups
      const groupMap = new Map<number, TabGroupData>();
      if (snapshot.groups && Array.isArray(snapshot.groups)) {
        snapshot.groups.forEach((group) => {
          groupMap.set(group.id, group);
        });
      }

      // Create a positional array that will preserve exact window order
      const orderedItems: Array<{
        type: "tab" | "group";
        id: number;
        index: number;
        data:
          | TabData
          | { id: number; name: string; color: string; tabs: TabData[] };
      }> = [];

      // Track which groups we've already added
      const processedGroups = new Set<number>();

      // Process all tabs in their original order
      tabsToDisplay.forEach((tab: TabData) => {
        const tabIndex = tab.index || 0;

        if (tab.groupId && tab.groupId !== -1) {
          // This is a grouped tab

          // If we haven't added this group yet, add it at this position
          if (!processedGroups.has(tab.groupId)) {
            processedGroups.add(tab.groupId);

            // Look up group info
            const groupInfo = groupMap.get(tab.groupId);

            // Create a new group with this tab
            const groupData = {
              id: tab.groupId,
              name: groupInfo?.title || `Group ${tab.groupId}`,
              color: groupInfo?.color || "#808080",
              tabs: [tab],
            };

            // Add group at the current tab's position
            orderedItems.push({
              type: "group",
              id: tab.groupId,
              index: tabIndex,
              data: groupData,
            });
          } else {
            // Find the existing group and add this tab to it
            const existingGroup = orderedItems.find(
              (item) => item.type === "group" && item.id === tab.groupId
            );

            if (existingGroup && existingGroup.type === "group") {
              (existingGroup.data as { tabs: TabData[] }).tabs.push(tab);
            }
          }
        } else {
          // This is an ungrouped tab, add it directly
          orderedItems.push({
            type: "tab",
            id: tab.id || tabIndex,
            index: tabIndex,
            data: tab,
          });
        }
      });

      // Sort the items by their index position
      orderedItems.sort((a, b) => a.index - b.index);

      return (
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {/* Render items in window order */}
          {orderedItems.map((item) => {
            if (item.type === "group") {
              const group = item.data as {
                id: number;
                name: string;
                color: string;
                tabs: TabData[];
              };
              return (
                <div
                  key={`group-${group.id}`}
                  className="flex items-center gap-1"
                >
                  <span
                    className="text-xs px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: group.color }}
                  >
                    {group.name}
                  </span>
                  <div className="flex -space-x-1">
                    {group.tabs
                      .sort((a, b) => (a.index || 0) - (b.index || 0)) // Sort tabs within group by index
                      .slice(0, 1)
                      .map((tab: TabData, idx: number) => (
                        <div
                          key={`group-tab-${group.id}-${idx}`}
                          className="h-5 w-5 rounded-full border border-white overflow-hidden bg-gray-100 flex items-center justify-center"
                          title={tab.title || tab.url || ""}
                        >
                          {tab.faviconUrl ? (
                            <img
                              src={tab.faviconUrl}
                              className="h-4 w-4"
                              alt=""
                              onError={(e) => {
                                e.currentTarget.src = "";
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-4 w-4 bg-gray-200 rounded-sm"></div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              );
            } else {
              const tab = item.data as TabData;
              return (
                <div
                  key={`tab-${tab.id || tab.index}`}
                  className="h-5 w-5 rounded-full border border-white overflow-hidden bg-gray-100 flex items-center justify-center"
                  title={tab.title || tab.url || ""}
                >
                  {tab.faviconUrl ? (
                    <img
                      src={tab.faviconUrl}
                      className="h-4 w-4"
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = "";
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-4 w-4 bg-gray-200 rounded-sm"></div>
                  )}
                </div>
              );
            }
          })}

          {/* Show remaining count if needed */}
          {remainingCount > 0 && (
            <span className="text-xs text-gray-500">
              and {remainingCount} more
            </span>
          )}
        </div>
      );
    };

    return (
      <ListItem
        key={snapshot.timestamp}
        title={
          <div>
            <EditableSnapshotName
              oopsWindowId={oopsWindowId}
              snapshot={snapshot}
              onUpdate={loadSnapshots}
            />
            {renderTabFavicons()}
          </div>
        }
        subtitle=""
        metadata={formatDate(snapshot.timestamp)}
        actions={
          <div className="flex space-x-1">
            <IconButton
              size="sm"
              variant="primary"
              onClick={() => handleRestore(oopsWindowId)}
              title="Restore session"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </IconButton>
            <IconButton
              size="sm"
              variant="danger"
              onClick={() => handleDelete(oopsWindowId)}
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
      {/* Snapshots */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h2">Window Snapshots</Typography>
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
        ) : Object.keys(snapshots).length === 0 ? (
          <Card className="p-5">
            <Typography variant="body">
              No snapshots available. Open some windows and tabs to create
              snapshots.
            </Typography>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            {Object.entries(snapshots)
              // Sort snapshots by timestamp, newest first
              .sort(([, a], [, b]) => {
                // Add checks for potentially undefined timestamps
                const timeA = a?.timestamp ?? 0;
                const timeB = b?.timestamp ?? 0;
                return timeB - timeA;
              })
              .map(([oopsWindowId, snapshot]) => {
                // Validate snapshot has the minimum required structure
                const isValidSnapshot =
                  snapshot &&
                  typeof snapshot === "object" &&
                  snapshot.timestamp;

                // Render the item directly or an invalid state item
                return isValidSnapshot ? (
                  renderSnapshotItem(oopsWindowId, snapshot)
                ) : (
                  <ListItem
                    key={`${oopsWindowId}-invalid`}
                    title="Invalid Snapshot"
                    subtitle="This snapshot is corrupted or has invalid data"
                    icon={<DocumentDuplicateIcon className="h-5 w-5" />}
                    actions={
                      <div className="flex space-x-1">
                        <IconButton
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(oopsWindowId)}
                          title="Delete snapshot"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </IconButton>
                      </div>
                    }
                  />
                );
              })}
          </Card>
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
