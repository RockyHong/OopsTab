import React, { useState, useEffect, useRef } from "react";
import {
  Typography,
  Card,
  Button,
  IconButton,
  ListItem,
  Modal,
  Toggle,
} from "../../components/ui";
import {
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  WindowIcon,
  ArrowPathIcon,
  ClockIcon as ClockSolidIcon,
} from "@heroicons/react/24/solid";
import {
  ClockIcon,
  RectangleStackIcon,
  StarIcon as StarOutlineIcon,
} from "@heroicons/react/24/outline";
import {
  getAllSnapshots,
  restoreSession,
  deleteSnapshot,
  renameSnapshot,
  getStorageStats,
  updateStorageStats,
  checkStorageLimits,
  toggleSnapshotStar,
  cleanupSnapshots,
} from "../../utils";
import {
  WindowSnapshot,
  DEFAULT_STORAGE_STATS,
  SnapshotMap,
  TabData,
  TabGroupData,
  WindowIdMap,
} from "../../types";
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
  return (
    <div className="content-container">
      <SnapshotsPanel />
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
  const [showAllStarred, setShowAllStarred] = useState(false);
  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set());
  const [storageStatus, setStorageStatus] = useState({
    percentUsed: 0,
    isApproachingLimit: false,
    warningMessage: "",
    usedBytes: 0,
    totalBytes: DEFAULT_STORAGE_STATS.totalBytes,
  });
  const scrollPositionRef = useRef<number>(0); // Ref to store scroll position

  // Lazy loading states
  const [visibleToday, setVisibleToday] = useState<number>(10); // Initial number of today's snapshots to show
  const [visibleYesterday, setVisibleYesterday] = useState<number>(5); // Initial number of yesterday's snapshots to show
  const [visibleOlderDates, setVisibleOlderDates] = useState<Set<string>>(
    new Set()
  ); // Track visible older dates
  const [visibleOlderItems, setVisibleOlderItems] = useState<
    Record<string, number>
  >({}); // Track items per older date
  const loadMoreObserverRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

  // State for confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    windowId: "",
  });

  // Initialize intersection observer for infinite scrolling
  useEffect(() => {
    const observerOptions = {
      root: null, // viewport
      rootMargin: "200px", // Start loading more before reaching the end
      threshold: 0.1, // Trigger when 10% of the element is visible
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !isLoading) {
        // Increase visible items when user scrolls near the end
        setVisibleToday((prev) => prev + 10);
        setVisibleYesterday((prev) => prev + 5);

        // For older dates, add more items to currently visible dates
        setVisibleOlderItems((prev) => {
          const newItems = { ...prev };
          visibleOlderDates.forEach((date) => {
            newItems[date] = (newItems[date] || 5) + 3;
          });
          return newItems;
        });
      }
    };

    loadMoreObserverRef.current = new IntersectionObserver(
      observerCallback,
      observerOptions
    );

    return () => {
      if (loadMoreObserverRef.current) {
        loadMoreObserverRef.current.disconnect();
      }
    };
  }, [
    isLoading,
    visibleOlderDates,
    visibleToday,
    visibleYesterday,
    visibleOlderItems,
  ]);

  // Observe the load more trigger element
  useEffect(() => {
    const observer = loadMoreObserverRef.current;
    const triggerElement = loadMoreTriggerRef.current;

    if (observer && triggerElement) {
      observer.observe(triggerElement);
      return () => {
        observer.unobserve(triggerElement);
      };
    }
  }, []); // This effect runs once after observer is set up

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
    scrollPositionRef.current = window.scrollY; // Save scroll position before loading
    setIsLoading(true);
    try {
      const snapshotMap = await getAllSnapshots();
      setSnapshots(snapshotMap);

      // Run automatic cleanup (keep starred, limit to 20 non-starred, delete older than 30 days)
      await cleanupSnapshots();

      // Also update storage status when loading snapshots
      await loadStorageStatus();

      // Don't reset visible counts when refreshing - this maintains the user's view state
      // Only reset if we detect a page reload via storage
      const sessionKey = "oopsTabSession";
      const sessionId = Math.random().toString(36).substring(2);

      const stored = localStorage.getItem(sessionKey);
      if (!stored) {
        // First load or page reload - reset visible counts
        setVisibleToday(10);
        setVisibleYesterday(5);
        setVisibleOlderDates(new Set());
        setVisibleOlderItems({});
        // Store new session
        localStorage.setItem(sessionKey, sessionId);
      }
    } catch (err) {
      console.error("Error loading snapshots:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check which windows are currently open
  const checkOpenWindows = async () => {
    try {
      // Get all windows
      const windows = await browser.windows.getAll();

      // Get the window ID map from storage
      const result = await browser.storage.local.get(["oopsWindowIdMap"]);
      const windowIdMap = (result.oopsWindowIdMap || {}) as WindowIdMap;

      // Create a set of open oopsWindowIds
      const openOopsWindowIds = new Set<string>();
      for (const window of windows) {
        if (window.id && windowIdMap[window.id]) {
          openOopsWindowIds.add(windowIdMap[window.id]);
        }
      }

      setOpenWindows(openOopsWindowIds);
    } catch (err) {
      console.error("Error checking open windows:", err);
    }
  };

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
    checkOpenWindows();

    // Set up listener for storage changes
    const handleStorageChanges = (changes: any, areaName: string) => {
      if (areaName === "local") {
        // Look for changes to the oopsSnapshots key
        if (changes.oopsSnapshots) {
          console.log("Snapshot storage changes detected, refreshing...");
          loadSnapshots();
          checkOpenWindows();
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChanges);

    // Clean up listener on unmount
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChanges);
    };
  }, []);

  // Effect to restore scroll position after loading
  useEffect(() => {
    if (!isLoading) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositionRef.current);
      });
    }
  }, [isLoading]);

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

  // Handle starring and unstarring
  const handleToggleStar = async (oopsWindowId: string, isStarred: boolean) => {
    await toggleSnapshotStar(oopsWindowId, isStarred);
    loadSnapshots();
  };

  // Render a snapshot list item
  const renderSnapshotItem = (
    oopsWindowId: string,
    snapshot: WindowSnapshot
  ) => {
    const isCurrentlyOpen = openWindows.has(oopsWindowId);

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
              {/* Currently Open Label */}
              {isCurrentlyOpen && (
                <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                  <WindowIcon className="h-3.5 w-3.5" />
                  <Typography variant="caption" className="font-medium">
                    Currently Open
                  </Typography>
                </div>
              )}
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
              variant={snapshot.isStarred ? "warning" : "secondary"}
              onClick={() =>
                handleToggleStar(oopsWindowId, !snapshot.isStarred)
              }
              title={snapshot.isStarred ? "Unstar snapshot" : "Star snapshot"}
            >
              {snapshot.isStarred ? (
                <StarIcon className="h-4 w-4 text-yellow-500" />
              ) : (
                <StarOutlineIcon className="h-4 w-4" />
              )}
            </IconButton>
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
      {/* Title and Refresh Button */}
      <div className="flex items-center justify-between mb-4">
        <Typography variant="h2" className="text-primary">
          Window Snapshots
        </Typography>
        <IconButton
          variant="primary"
          size="sm"
          onClick={loadSnapshots}
          disabled={isLoading}
          title="Refresh Snapshots"
        >
          <ArrowPathIcon
            className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
          />
        </IconButton>
      </div>

      {/* Snapshots */}
      <div className="mb-6 space-y-4">
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
          <>
            {/* Starred Snapshots Card */}
            {(() => {
              // Group snapshots by date and starred status
              type GroupedSnapshots = {
                starred: [string, WindowSnapshot][];
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
                // Group by starred status and date
                .reduce(
                  (acc: GroupedSnapshots, [oopsWindowId, snapshot]) => {
                    // First check if it's a starred snapshot
                    if (snapshot?.isStarred) {
                      acc.starred.push([oopsWindowId, snapshot]);
                      return acc;
                    }

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
                  {
                    starred: [],
                    today: [],
                    yesterday: [],
                    older: {},
                    invalid: [],
                  }
                );

              // Render starred snapshots
              if (grouped.starred.length > 0) {
                const visibleStarredItems = showAllStarred
                  ? grouped.starred
                  : grouped.starred.slice(0, 3);

                return (
                  <Card className="p-0 overflow-hidden border rounded-lg">
                    <div className="snapshot-section-header">
                      <Typography
                        variant="h4"
                        className="font-semibold flex items-center text-primary-dark"
                      >
                        <StarIcon className="h-4 w-4 text-yellow-500 mr-1.5" />
                        Starred Snapshots
                      </Typography>
                    </div>

                    {/* Starred snapshot items */}
                    {visibleStarredItems.map(([id, snapshot]) =>
                      renderSnapshotItem(id, snapshot)
                    )}

                    {/* Show more/less button */}
                    {grouped.starred.length > 3 && (
                      <div
                        className="w-full p-2 border-t border-gray-200 bg-gray-100/40 hover:bg-gray-100 cursor-pointer text-sm text-gray-600 flex items-center justify-center"
                        onClick={() => setShowAllStarred(!showAllStarred)}
                      >
                        {showAllStarred ? (
                          <>
                            <ChevronUpIcon className="h-4 w-4 mr-1" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDownIcon className="h-4 w-4 mr-1" />
                            Show {grouped.starred.length - 3} more
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                );
              } else if (
                grouped.today.length > 0 ||
                grouped.yesterday.length > 0 ||
                Object.keys(grouped.older).length > 0
              ) {
                // Show explainer about starring if we have snapshots but none are starred
                return (
                  <Card className="p-4 bg-blue-50">
                    <Typography
                      variant="body"
                      className="flex items-center text-blue-700"
                    >
                      <StarOutlineIcon className="h-4 w-4 text-blue-500 mr-1 flex-shrink-0" />
                      <span>
                        You can star important snapshots to make them persist
                        during cleanup. Starred snapshots will appear here.
                      </span>
                    </Typography>
                  </Card>
                );
              }

              return null;
            })()}

            {/* Recent Snapshots Card */}
            <Card className="p-0 overflow-hidden border rounded-lg">
              {(() => {
                // Group snapshots by date and starred status
                type GroupedSnapshots = {
                  starred: [string, WindowSnapshot][];
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
                      // Skip starred snapshots for the history section
                      if (snapshot?.isStarred) {
                        return acc;
                      }

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
                      const yesterdayStr = yesterday
                        .toISOString()
                        .split("T")[0];

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
                    {
                      starred: [],
                      today: [],
                      yesterday: [],
                      older: {},
                      invalid: [],
                    }
                  );

                // Render sections with dividers
                const sections: JSX.Element[] = [];

                // Today section
                if (grouped.today.length > 0) {
                  // Apply lazy loading - only show the number of items in visibleToday
                  const visibleTodayItems = grouped.today.slice(
                    0,
                    visibleToday
                  );
                  const hasMoreToday =
                    grouped.today.length > visibleTodayItems.length;

                  sections.push(
                    <div key="today-section">
                      <div className="snapshot-section-header rounded-t-lg">
                        <Typography
                          variant="h4"
                          className="font-semibold flex items-center text-primary-dark"
                        >
                          <ClockSolidIcon className="h-4 w-4 text-primary mr-1.5" />
                          Recent Snapshots
                        </Typography>
                      </div>
                      {visibleTodayItems.map(([id, snapshot]) =>
                        renderSnapshotItem(id, snapshot)
                      )}
                      {hasMoreToday && (
                        <div className="p-2 bg-gray-50 border-t border-gray-200 text-center">
                          <Typography
                            variant="caption"
                            className="text-gray-500"
                          >
                            Scroll to load more (
                            {grouped.today.length - visibleTodayItems.length}{" "}
                            remaining)
                          </Typography>
                        </div>
                      )}
                    </div>
                  );
                }

                // Yesterday section
                if (grouped.yesterday.length > 0) {
                  // Apply lazy loading - only show the number of items in visibleYesterday
                  const visibleYesterdayItems = grouped.yesterday.slice(
                    0,
                    visibleYesterday
                  );
                  const hasMoreYesterday =
                    grouped.yesterday.length > visibleYesterdayItems.length;

                  sections.push(
                    <div key="yesterday-section">
                      <div className="p-2 bg-gray-100/60 border-b border-gray-200">
                        <Typography
                          variant="body-sm"
                          className="font-medium text-gray-600"
                        >
                          Yesterday
                        </Typography>
                      </div>
                      {visibleYesterdayItems.map(([id, snapshot]) =>
                        renderSnapshotItem(id, snapshot)
                      )}
                      {hasMoreYesterday && (
                        <div className="p-2 bg-gray-50 border-t border-gray-200 text-center">
                          <Typography
                            variant="caption"
                            className="text-gray-500"
                          >
                            Scroll to load more (
                            {grouped.yesterday.length -
                              visibleYesterdayItems.length}{" "}
                            remaining)
                          </Typography>
                        </div>
                      )}
                    </div>
                  );
                }

                // Older sections
                const olderDates = Object.keys(grouped.older).sort((a, b) => {
                  // Try to sort by date, newest first
                  // This is a simplistic approach as we're sorting strings
                  // A more accurate approach would be to parse the dates
                  return b.localeCompare(a);
                });

                // Only show first few old date sections initially, add more on scroll
                // If visibleOlderDates is empty, start with first few dates
                if (visibleOlderDates.size === 0 && olderDates.length > 0) {
                  // Initially show first 2 dates
                  const initialDates = olderDates.slice(0, 2);
                  setVisibleOlderDates(new Set(initialDates));

                  // Set initial items per date
                  const initialItems: Record<string, number> = {};
                  initialDates.forEach((date) => {
                    initialItems[date] = 5; // Show 5 items per date initially
                  });
                  setVisibleOlderItems(initialItems);
                }

                // Render visible older date sections
                for (const date of olderDates) {
                  const items = grouped.older[date];

                  // If this date isn't in our visible set and we have some dates visible already, skip it
                  if (
                    !visibleOlderDates.has(date) &&
                    visibleOlderDates.size > 0
                  ) {
                    continue;
                  }

                  // Get number of visible items for this date
                  const visibleCount = visibleOlderItems[date] || 5;
                  const visibleItems = items.slice(0, visibleCount);
                  const hasMoreItems = items.length > visibleItems.length;

                  sections.push(
                    <div key={`date-${date}`}>
                      <div className="p-2 bg-gray-100/60 border-b border-gray-200">
                        <Typography
                          variant="body-sm"
                          className="font-medium text-gray-600"
                        >
                          {date}
                        </Typography>
                      </div>
                      {visibleItems.map(([id, snapshot]) =>
                        renderSnapshotItem(id, snapshot)
                      )}
                      {hasMoreItems && (
                        <div className="p-2 bg-gray-50 border-t border-gray-200 text-center">
                          <Typography
                            variant="caption"
                            className="text-gray-500"
                          >
                            Scroll to load more (
                            {items.length - visibleItems.length} remaining)
                          </Typography>
                        </div>
                      )}
                    </div>
                  );
                }

                // Show a "Load More Dates" button if we have more dates to display
                const remainingDates = olderDates.filter(
                  (date) => !visibleOlderDates.has(date)
                );
                if (remainingDates.length > 0 && visibleOlderDates.size > 0) {
                  sections.push(
                    <div
                      key="load-more-dates"
                      className="p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer text-center border-t border-gray-200"
                      onClick={() => {
                        // Add next 2 dates to visible dates
                        const nextDates = remainingDates.slice(0, 2);
                        setVisibleOlderDates(
                          (prev) => new Set([...prev, ...nextDates])
                        );

                        // Initialize items for these dates
                        setVisibleOlderItems((prev) => {
                          const newItems = { ...prev };
                          nextDates.forEach((date) => {
                            newItems[date] = 5; // Show 5 items initially
                          });
                          return newItems;
                        });
                      }}
                    >
                      <Typography
                        variant="body-sm"
                        className="text-primary font-medium"
                      >
                        Load {Math.min(2, remainingDates.length)} more date
                        {remainingDates.length !== 1 ? "s" : ""} (
                        {remainingDates.length} remaining)
                      </Typography>
                    </div>
                  );
                }

                // Invalid snapshots section (if any)
                if (grouped.invalid.length > 0) {
                  const visibleInvalid = grouped.invalid.slice(0, 3); // Only show first 3 invalid

                  sections.push(
                    <div key="invalid-section">
                      <div className="p-2 bg-gray-100/60 border-b border-gray-200">
                        <Typography
                          variant="body-sm"
                          className="font-medium text-gray-600"
                        >
                          Corrupted or Invalid Snapshots
                        </Typography>
                      </div>
                      {visibleInvalid.map(([id, snapshot]) => {
                        // Validate snapshot has the minimum required structure
                        const isValidSnapshot =
                          snapshot &&
                          typeof snapshot === "object" &&
                          snapshot.timestamp;

                        // Render the item directly or an invalid state item
                        return isValidSnapshot ? (
                          renderSnapshotItem(id, snapshot)
                        ) : (
                          <ListItem
                            key={`${id}-invalid`}
                            title="Invalid Snapshot"
                            subtitle="This snapshot is corrupted or has invalid data"
                            metadata=""
                            actions={
                              <div className="flex space-x-1">
                                <IconButton
                                  size="sm"
                                  variant="danger"
                                  onClick={() => handleDelete(id)}
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

                // Add a load more trigger div at the end
                sections.push(
                  <div
                    key="load-more-trigger"
                    ref={loadMoreTriggerRef}
                    className="h-4 opacity-0 -mb-4" // Reduced height and negative margin to avoid spacing
                  />
                );

                // If no sections to show
                if (sections.length === 0) {
                  return (
                    <div className="p-5">
                      <Typography variant="body">
                        No recent snapshots available.
                      </Typography>
                    </div>
                  );
                }

                return sections;
              })()}
            </Card>
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
