import React, { useState, useEffect, useRef } from "react";
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
import { ClockIcon, RectangleStackIcon } from "@heroicons/react/24/outline";
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

// --- New Component for Dynamic Favicon List ---
interface DynamicFaviconListProps {
  tabs: TabData[];
  groups?: TabGroupData[];
}

const DynamicFaviconList: React.FC<DynamicFaviconListProps> = ({
  tabs = [],
  groups = [],
}) => {
  // --- Start: Logic moved from renderTabFavicons ---
  // Create a map for quick group lookups
  const groupMap = new Map<number, TabGroupData>();
  if (groups && Array.isArray(groups)) {
    groups.forEach((group) => {
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
  const processedGroups = new Set<number>();

  // Process all tabs to build orderedItems
  tabs.forEach((tab: TabData) => {
    const tabIndex = tab.index || 0;
    if (tab.groupId && tab.groupId !== -1) {
      if (!processedGroups.has(tab.groupId)) {
        processedGroups.add(tab.groupId);
        const groupInfo = groupMap.get(tab.groupId);
        const groupData = {
          id: tab.groupId,
          name: groupInfo?.title || `Group ${tab.groupId}`,
          color: groupInfo?.color || "#808080",
          tabs: [tab],
        };
        orderedItems.push({
          type: "group",
          id: tab.groupId,
          index: tabIndex,
          data: groupData,
        });
      } else {
        const existingGroup = orderedItems.find(
          (item) => item.type === "group" && item.id === tab.groupId
        );
        if (existingGroup && existingGroup.type === "group") {
          (existingGroup.data as { tabs: TabData[] }).tabs.push(tab);
        }
      }
    } else {
      orderedItems.push({
        type: "tab",
        id: tab.id || tabIndex,
        index: tabIndex,
        data: tab,
      });
    }
  });
  orderedItems.sort((a, b) => a.index - b.index);

  // --- Dynamic Item Calculation Logic (Hooks are safe here) ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxVisibleItems, setMaxVisibleItems] = useState<number>(Infinity);
  const estimatedItemWidth = 28; // Approx width: icon(20) + border(2) + gap(4) + buffer(2)
  const moreTextWidth = 60; // Estimated width for '+ X more' text

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;

    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        for (let entry of entries) {
          const containerWidth = entry.contentRect.width;
          let potentialMax = Math.max(
            0,
            Math.floor(containerWidth / estimatedItemWidth)
          );
          if (potentialMax < orderedItems.length) {
            potentialMax = Math.max(
              0,
              Math.floor((containerWidth - moreTextWidth) / estimatedItemWidth)
            );
          }
          setMaxVisibleItems(potentialMax);
        }
      });
    });

    observer.observe(container);

    requestAnimationFrame(() => {
      if (containerRef.current) {
        const initialWidth = containerRef.current.offsetWidth;
        let initialMax = Math.max(
          0,
          Math.floor(initialWidth / estimatedItemWidth)
        );
        if (initialMax < orderedItems.length) {
          initialMax = Math.max(
            0,
            Math.floor((initialWidth - moreTextWidth) / estimatedItemWidth)
          );
        }
        setMaxVisibleItems(initialMax);
      }
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [orderedItems.length, estimatedItemWidth, moreTextWidth]);

  const visibleItems = orderedItems.slice(0, maxVisibleItems);
  const remainingCount = orderedItems.length - visibleItems.length;
  // --- End: Logic moved from renderTabFavicons ---

  // Return the JSX for the list
  return (
    <div
      ref={containerRef}
      className="flex items-center overflow-hidden mt-1 gap-1"
    >
      {visibleItems.map((item) => {
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
              className="flex items-center gap-1 flex-shrink-0"
            >
              <span
                className="text-xs px-1.5 py-0.5 rounded text-white whitespace-nowrap"
                style={{ backgroundColor: group.color }}
              >
                {group.name}
              </span>
              {group.tabs.length > 0 && (
                <div
                  key={`group-tab-${group.id}-0`}
                  className="h-5 w-5 rounded-full border border-white overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0"
                  title={group.tabs[0].title || group.tabs[0].url || ""}
                >
                  {group.tabs[0].faviconUrl ? (
                    <img
                      src={group.tabs[0].faviconUrl}
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
              )}
            </div>
          );
        } else {
          const tab = item.data as TabData;
          return (
            <div
              key={`tab-${tab.id || tab.index}`}
              className="h-5 w-5 rounded-full border border-white overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0"
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

      {remainingCount > 0 && (
        <span className="text-xs text-gray-500 ml-1 whitespace-nowrap flex-shrink-0">
          + {remainingCount} more
        </span>
      )}
    </div>
  );
};
// --- End New Component ---

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
            {/* Row for icons and labels */}
            <div className="flex items-center space-x-3 mt-1 text-gray-600">
              {/* Tab Count Label */}
              <div className="flex items-center space-x-1">
                <RectangleStackIcon className="h-3.5 w-3.5" />
                <Typography variant="caption">
                  {snapshot.tabs.length} tab
                  {snapshot.tabs.length !== 1 ? "s" : ""}
                </Typography>
              </div>
              {/* Timestamp Label */}
              <div className="flex items-center space-x-1">
                <ClockIcon className="h-3.5 w-3.5" />
                <Typography variant="caption">
                  {formatDate(snapshot.timestamp)}
                </Typography>
              </div>
            </div>

            {/* Render the new DynamicFaviconList component */}
            <div className="mt-2">
              <DynamicFaviconList
                tabs={snapshot.tabs}
                groups={snapshot.groups}
              />
            </div>
          </div>
        }
        subtitle=""
        metadata="" // Timestamp moved to title section
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
            {(() => {
              // Group snapshots by date
              type GroupedSnapshots = {
                today: [string, WindowSnapshot][];
                yesterday: [string, WindowSnapshot][];
                older: { [date: string]: [string, WindowSnapshot][] };
                invalid: [string, WindowSnapshot][];
              };

              const grouped = Object.entries(snapshots)
                // Sort snapshots by timestamp, newest first
                .sort(([, a], [, b]) => {
                  // Add checks for potentially undefined timestamps
                  const timeA = a?.timestamp ?? 0;
                  const timeB = b?.timestamp ?? 0;
                  return timeB - timeA;
                })
                // Group by date
                .reduce(
                  (acc: GroupedSnapshots, [oopsWindowId, snapshot]) => {
                    // Skip invalid snapshots in grouping
                    if (!snapshot || !snapshot.timestamp) {
                      acc.invalid.push([oopsWindowId, snapshot]);
                      return acc;
                    }

                    const date = new Date(snapshot.timestamp);
                    const today = new Date();
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);

                    // Format for comparison (YYYY-MM-DD)
                    const dateStr = date.toISOString().split("T")[0];
                    const todayStr = today.toISOString().split("T")[0];
                    const yesterdayStr = yesterday.toISOString().split("T")[0];

                    if (dateStr === todayStr) {
                      acc.today.push([oopsWindowId, snapshot]);
                    } else if (dateStr === yesterdayStr) {
                      acc.yesterday.push([oopsWindowId, snapshot]);
                    } else {
                      // Group older snapshots by date
                      const shortDate = date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      if (!acc.older[shortDate]) {
                        acc.older[shortDate] = [];
                      }
                      acc.older[shortDate].push([oopsWindowId, snapshot]);
                    }

                    return acc;
                  },
                  { today: [], yesterday: [], older: {}, invalid: [] }
                );

              // Render sections with dividers
              const sections: JSX.Element[] = [];

              // Today section
              if (grouped.today.length > 0) {
                sections.push(
                  <div key="today-section">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <Typography
                        variant="body"
                        className="font-medium text-gray-600"
                      >
                        Today
                      </Typography>
                    </div>
                    {grouped.today.map(([oopsWindowId, snapshot]) =>
                      renderSnapshotItem(oopsWindowId, snapshot)
                    )}
                  </div>
                );
              }

              // Yesterday section
              if (grouped.yesterday.length > 0) {
                sections.push(
                  <div key="yesterday-section">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <Typography
                        variant="body"
                        className="font-medium text-gray-600"
                      >
                        Yesterday
                      </Typography>
                    </div>
                    {grouped.yesterday.map(([oopsWindowId, snapshot]) =>
                      renderSnapshotItem(oopsWindowId, snapshot)
                    )}
                  </div>
                );
              }

              // Older sections by date
              Object.entries(grouped.older).forEach(([dateStr, items]) => {
                sections.push(
                  <div key={`date-${dateStr}`}>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <Typography
                        variant="body"
                        className="font-medium text-gray-600"
                      >
                        {dateStr}
                      </Typography>
                    </div>
                    {items.map(([oopsWindowId, snapshot]) =>
                      renderSnapshotItem(oopsWindowId, snapshot)
                    )}
                  </div>
                );
              });

              // Invalid snapshots section (if any)
              if (grouped.invalid.length > 0) {
                sections.push(
                  <div key="invalid-section">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <Typography
                        variant="body"
                        className="font-medium text-gray-600"
                      >
                        Invalid Snapshots
                      </Typography>
                    </div>
                    {grouped.invalid.map(([oopsWindowId, snapshot]) => {
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
                  </div>
                );
              }

              return sections;
            })()}
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
