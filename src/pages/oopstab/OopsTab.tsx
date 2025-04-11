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
  Tag,
  TagSelector,
  SearchInput,
  SortSelect,
} from "../../components/ui";
import {
  CogIcon,
  ArrowPathIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowPathRoundedSquareIcon,
  BeakerIcon,
  StarIcon as SolidStarIcon,
} from "@heroicons/react/24/solid";
import { StarIcon as OutlineStarIcon } from "@heroicons/react/24/outline";
import {
  getAllSnapshots,
  WindowEntry,
  WindowSnapshot,
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
  starSnapshot,
  getStarredSnapshots,
  restoreSession,
  restoreMultipleSessions,
  deleteSnapshotWithUndo,
  getUndoBuffer,
  undoDelete,
  DeletedSnapshot,
  formatRelativeTime,
  formatDateTime,
  formatFileSize,
} from "../../utils";

import {
  getAllTags,
  createTag,
  addTagToSnapshot,
  removeTagFromSnapshot,
  Tag as TagType,
  TAG_COLORS,
} from "../../utils/tagManager";

const OopsTab: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Set up debug functionality when component mounts
  useEffect(() => {
    setupDebugActions();
  }, []);

  // Get user locale from browser
  const userLocale = navigator.language;

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

  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  // New state for search and sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [tabCountFilter, setTabCountFilter] = useState({ min: 0, max: 100 });
  const [dateRangeFilter, setDateRangeFilter] = useState({
    from: "",
    to: "",
  });

  // State for multi-selection
  const [selectedSessions, setSelectedSessions] = useState<
    {
      oopsWindowId: string;
      timestamp: number;
    }[]
  >([]);

  // State for multi-restore modal
  const [multiRestoreModal, setMultiRestoreModal] = useState({
    isOpen: false,
    combineIntoOneWindow: false,
  });

  // State for undo notification
  const [undoState, setUndoState] = useState<{
    show: boolean;
    oopsWindowId: string;
    timestamp: number;
    snapshotName: string;
    timeoutId: NodeJS.Timeout | null;
  }>({
    show: false,
    oopsWindowId: "",
    timestamp: 0,
    snapshotName: "",
    timeoutId: null,
  });

  // State for undo history panel
  const [undoHistoryModal, setUndoHistoryModal] = useState({
    isOpen: false,
    items: [] as DeletedSnapshot[],
    isLoading: false,
  });

  // Sort options
  const sortOptions = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "nameAZ", label: "Name (A-Z)" },
    { value: "nameZA", label: "Name (Z-A)" },
    { value: "tabsHighLow", label: "Most Tabs" },
    { value: "tabsLowHigh", label: "Least Tabs" },
  ];

  // Get user locale from browser
  const userLocale = navigator.language;

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

  // Load snapshots and tags
  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const snapshots = await getAllSnapshots();
      setWindowEntries(snapshots);

      // Load tags
      const tags = await getAllTags();
      setAllTags(tags);

      // Also update storage status when loading snapshots
      await loadStorageStatus();
    } catch (err) {
      console.error("Failed to load snapshots:", err);
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

  // Use deleteSnapshotWithUndo instead of deleteSnapshot
  const handleDelete = async (oopsWindowId: string, timestamp: number) => {
    setConfirmDialog({
      isOpen: false,
      windowId: "",
      timestamp: 0,
    });

    // Find snapshot to get its name
    const entry = windowEntries.find(
      (entry) => entry.oopsWindowId === oopsWindowId
    );
    const snapshot = entry?.snapshots.find((s) => s.timestamp === timestamp);

    if (!snapshot) return;

    const snapshotName = snapshot.customName || formatSnapshotName(snapshot);

    try {
      const success = await deleteSnapshotWithUndo(
        oopsWindowId,
        timestamp,
        30000
      );

      if (success) {
        // Show undo notification
        showUndoNotification(oopsWindowId, timestamp, snapshotName);

        // Refresh the snapshot list
        await loadSnapshots();
      }
    } catch (error) {
      console.error("Error deleting snapshot:", error);
    }
  };

  // Helper to generate a snapshot name
  const formatSnapshotName = (snapshot: WindowSnapshot): string => {
    if (snapshot.tabs.length === 0) return "Empty Session";
    return snapshot.tabs[0].title || "Untitled Tab";
  };

  // Show the undo notification with timeout
  const showUndoNotification = (
    oopsWindowId: string,
    timestamp: number,
    snapshotName: string
  ) => {
    // Clear existing timeout if there's one active
    if (undoState.timeoutId) {
      clearTimeout(undoState.timeoutId);
    }

    // Create new timeout
    const timeoutId = setTimeout(() => {
      setUndoState((prev) => ({ ...prev, show: false }));
    }, 10000); // Show for 10 seconds

    // Update state
    setUndoState({
      show: true,
      oopsWindowId,
      timestamp,
      snapshotName,
      timeoutId,
    });
  };

  // Handle undo action
  const handleUndo = async () => {
    const { oopsWindowId, timestamp, timeoutId } = undoState;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    setUndoState({
      show: false,
      oopsWindowId: "",
      timestamp: 0,
      snapshotName: "",
      timeoutId: null,
    });

    try {
      await undoDelete(oopsWindowId, timestamp);
      await loadSnapshots();
    } catch (error) {
      console.error("Error undoing delete:", error);
    }
  };

  // Load undo history
  const loadUndoHistory = async () => {
    try {
      setUndoHistoryModal((prev) => ({ ...prev, isLoading: true }));

      const buffer = await getUndoBuffer();

      setUndoHistoryModal({
        isOpen: true,
        items: buffer,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error loading undo history:", error);
      setUndoHistoryModal((prev) => ({ ...prev, isLoading: false }));
    }
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

  // Handle tag creation
  const handleCreateTag = async (
    name: string,
    color: string
  ): Promise<TagType | null> => {
    try {
      const newTag = await createTag(name, color);

      // Update local tag state
      setAllTags((prev) => [...prev, newTag]);

      return newTag;
    } catch (error) {
      console.error("Error creating tag:", error);
      throw error;
    }
  };

  // Toggle tag on a snapshot
  const handleTagToggle = async (
    oopsWindowId: string,
    timestamp: number,
    tagId: string
  ) => {
    // Check if snapshot already has this tag
    const entry = windowEntries.find(
      (entry) => entry.oopsWindowId === oopsWindowId
    );
    const snapshot = entry?.snapshots.find((s) => s.timestamp === timestamp);

    if (!snapshot) return;

    const hasTag = snapshot.tags?.includes(tagId) || false;

    try {
      if (hasTag) {
        await removeTagFromSnapshot(oopsWindowId, timestamp, tagId);
      } else {
        await addTagToSnapshot(oopsWindowId, timestamp, tagId);
      }

      // Refresh snapshots after tag change
      await loadSnapshots();
    } catch (error) {
      console.error("Error toggling tag:", error);
    }
  };

  // Filter snapshots by tag
  const filterByTag = (tagId: string | null) => {
    setActiveFilter(tagId);
  };

  // Function to handle starring/unstarring a snapshot
  const handleStarToggle = async (
    oopsWindowId: string,
    timestamp: number,
    isCurrentlyStarred: boolean
  ) => {
    try {
      await starSnapshot(oopsWindowId, timestamp, !isCurrentlyStarred);
      await loadSnapshots();
    } catch (error) {
      console.error("Error toggling star status:", error);
    }
  };

  // Toggle session selection for multi-restore
  const toggleSessionSelection = (oopsWindowId: string, timestamp: number) => {
    setSelectedSessions((prev) => {
      const isAlreadySelected = prev.some(
        (session) =>
          session.oopsWindowId === oopsWindowId &&
          session.timestamp === timestamp
      );

      if (isAlreadySelected) {
        return prev.filter(
          (session) =>
            !(
              session.oopsWindowId === oopsWindowId &&
              session.timestamp === timestamp
            )
        );
      } else {
        return [...prev, { oopsWindowId, timestamp }];
      }
    });
  };

  // Clear all selected sessions
  const clearSelectedSessions = () => {
    setSelectedSessions([]);
  };

  // Handle multi-session restore
  const handleMultiRestore = async (combineIntoOneWindow: boolean) => {
    if (selectedSessions.length === 0) return;

    try {
      const success = await restoreMultipleSessions(
        selectedSessions,
        combineIntoOneWindow
      );

      if (success) {
        // Clear selection after successful restore
        clearSelectedSessions();
        setMultiRestoreModal({ isOpen: false, combineIntoOneWindow: false });
      } else {
        alert("There was an error restoring multiple sessions");
      }
    } catch (error) {
      console.error("Error in multi-session restore:", error);
      alert("There was an error restoring multiple sessions");
    }
  };

  // Get filtered and sorted entries
  const getFilteredEntries = (): WindowEntry[] => {
    if (!windowEntries.length) return [];

    // First, apply filters to get matching snapshots
    let filtered = [...windowEntries]
      .map((entry) => {
        // Create a copy with filtered snapshots
        return {
          ...entry,
          snapshots: entry.snapshots.filter((snapshot) => {
            // Active tag filter
            if (
              activeFilter &&
              (!snapshot.tags || !snapshot.tags.includes(activeFilter))
            ) {
              return false;
            }

            // Starred filter
            if (showStarredOnly && !snapshot.starred) {
              return false;
            }

            // Search query
            if (searchQuery) {
              const searchableText = [
                snapshot.customName || "",
                ...snapshot.tabs.map((tab) => tab.title || ""),
                ...snapshot.tabs.map((tab) => tab.url || ""),
              ]
                .join(" ")
                .toLowerCase();

              if (!searchableText.includes(searchQuery.toLowerCase())) {
                return false;
              }
            }

            // Tab count filter
            const tabCount = snapshot.tabs.length;
            if (
              tabCount < tabCountFilter.min ||
              tabCount > tabCountFilter.max
            ) {
              return false;
            }

            // Date range filter - "from" date
            if (dateRangeFilter.from) {
              const fromDate = new Date(dateRangeFilter.from).getTime();
              if (snapshot.timestamp < fromDate) {
                return false;
              }
            }

            // Date range filter - "to" date
            if (dateRangeFilter.to) {
              const toDate =
                new Date(dateRangeFilter.to).getTime() + 24 * 60 * 60 * 1000; // Include the entire day
              if (snapshot.timestamp > toDate) {
                return false;
              }
            }

            return true;
          }),
        };
      })
      .filter((entry) => entry.snapshots.length > 0);

    // Next, sort the results based on the selected sort option
    if (sortOption !== "newest") {
      // Sort snapshots in each entry
      filtered = filtered.map((entry) => {
        const sortedSnapshots = [...entry.snapshots].sort((a, b) => {
          switch (sortOption) {
            case "oldest":
              return a.timestamp - b.timestamp;
            case "nameAZ":
              return (a.customName || "").localeCompare(b.customName || "");
            case "nameZA":
              return (b.customName || "").localeCompare(a.customName || "");
            case "tabsHighLow":
              return b.tabs.length - a.tabs.length;
            case "tabsLowHigh":
              return a.tabs.length - b.tabs.length;
            default:
              return 0;
          }
        });

        return {
          ...entry,
          snapshots: sortedSnapshots,
        };
      });
    }

    return filtered;
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery("");
    setSortOption("newest");
    setActiveFilter(null);
    setShowStarredOnly(false);
    setTabCountFilter({ min: 0, max: 100 });
    setDateRangeFilter({ from: "", to: "" });
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
    // Get top tab titles for display
    const topTabs = snapshot.tabs
      .slice(0, 2)
      .map((tab) => tab.title || "Untitled");

    const tabCountText = `${snapshot.tabs.length} tab${
      snapshot.tabs.length !== 1 ? "s" : ""
    }`;

    // Get snapshot tags
    const snapshotTags = allTags.filter((tag) =>
      snapshot.tags?.includes(tag.id)
    );

    // Check if this snapshot is selected for multi-restore
    const isSelected = selectedSessions.some(
      (session) =>
        session.oopsWindowId === entry.oopsWindowId &&
        session.timestamp === snapshot.timestamp
    );

    return (
      <Card
        key={snapshot.timestamp}
        className={`mb-3 ${
          isSaved ? "border-l-4 border-l-primary" : ""
        } hover:shadow-md transition-shadow ${
          snapshot.starred ? "bg-amber-50" : ""
        } ${isSelected ? "ring-2 ring-primary" : ""}`}
        onClick={() =>
          toggleSessionSelection(entry.oopsWindowId, snapshot.timestamp)
        }
      >
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <div className="flex-grow">
              <div className="flex items-center space-x-1">
                <IconButton
                  size="sm"
                  onClick={() =>
                    handleStarToggle(
                      entry.oopsWindowId,
                      snapshot.timestamp,
                      !!snapshot.starred
                    )
                  }
                  aria-label={
                    snapshot.starred ? "Unstar session" : "Star session"
                  }
                  className={
                    snapshot.starred ? "text-amber-500" : "text-gray-400"
                  }
                >
                  {snapshot.starred ? (
                    <SolidStarIcon className="h-5 w-5" />
                  ) : (
                    <OutlineStarIcon className="h-5 w-5" />
                  )}
                </IconButton>
                <EditableSnapshotName
                  oopsWindowId={entry.oopsWindowId}
                  snapshot={snapshot}
                  onUpdate={loadSnapshots}
                />
              </div>
              <div
                className="text-gray-500 text-sm"
                title={formatDateTime(snapshot.timestamp, userLocale)}
              >
                {formatRelativeTime(snapshot.timestamp, userLocale)}
              </div>
            </div>

            <div className="flex space-x-1 items-center">
              <span className="text-sm font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                {tabCountText}
              </span>

              <IconButton
                size="sm"
                onClick={() => handleRestore(entry.oopsWindowId, snapshot)}
                aria-label="Restore session"
              >
                <ArrowPathRoundedSquareIcon className="h-4 w-4" />
              </IconButton>

              {!isSaved && (
                <IconButton
                  size="sm"
                  onClick={() =>
                    handleSaveSnapshot(entry.oopsWindowId, snapshot.timestamp)
                  }
                  aria-label="Save snapshot"
                >
                  <DocumentDuplicateIcon className="h-4 w-4" />
                </IconButton>
              )}

              <IconButton
                size="sm"
                variant="danger"
                onClick={() =>
                  setConfirmDialog({
                    isOpen: true,
                    windowId: entry.oopsWindowId,
                    timestamp: snapshot.timestamp,
                  })
                }
                aria-label="Delete snapshot"
              >
                <TrashIcon className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          {/* Tab titles preview */}
          <div className="text-sm text-gray-700">
            <ul className="space-y-1">
              {topTabs.map((title, i) => (
                <li key={i} className="truncate">
                  {title}
                </li>
              ))}
              {snapshot.tabs.length > 2 && (
                <li className="text-gray-500 text-xs">
                  + {snapshot.tabs.length - 2} more tabs
                </li>
              )}
            </ul>
          </div>

          {/* Tags section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex flex-wrap gap-1.5">
              {snapshotTags.map((tag) => (
                <Tag
                  key={tag.id}
                  id={tag.id}
                  label={tag.name}
                  color={tag.color}
                  size="sm"
                  onClick={() => filterByTag(tag.id)}
                />
              ))}

              <Button
                variant="passive"
                size="xs"
                onClick={() => {
                  // Open tag editor modal
                  setTagEditorState({
                    isOpen: true,
                    windowId: entry.oopsWindowId,
                    timestamp: snapshot.timestamp,
                    selectedTags: snapshot.tags || [],
                  });
                }}
              >
                {snapshotTags.length > 0 ? "Edit Tags" : "Add Tags"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // State for tag editor modal
  const [tagEditorState, setTagEditorState] = useState({
    isOpen: false,
    windowId: "",
    timestamp: 0,
    selectedTags: [] as string[],
  });

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="bg-white p-3 rounded-lg shadow-sm">
        <div className="flex flex-col gap-3">
          {/* Search and basic filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search sessions..."
              className="flex-grow max-w-xl"
            />

            <div className="flex items-center gap-3">
              <SortSelect
                options={sortOptions}
                value={sortOption}
                onChange={setSortOption}
              />

              <Button
                variant="passive"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? "Hide Filters" : "Show Filters"}
              </Button>

              {(searchQuery ||
                activeFilter ||
                showStarredOnly ||
                sortOption !== "newest" ||
                tabCountFilter.min > 0 ||
                tabCountFilter.max < 100 ||
                dateRangeFilter.from ||
                dateRangeFilter.to) && (
                <Button variant="passive" size="sm" onClick={resetFilters}>
                  Reset All
                </Button>
              )}
            </div>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="pt-3 border-t">
              <div className="flex flex-wrap gap-6">
                {/* Tags */}
                {allTags.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Tags
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {allTags.map((tag) => (
                        <Tag
                          key={tag.id}
                          id={tag.id}
                          label={tag.name}
                          color={tag.color}
                          size="sm"
                          onClick={() =>
                            filterByTag(activeFilter === tag.id ? null : tag.id)
                          }
                          className={
                            activeFilter === tag.id
                              ? "ring-1 ring-offset-1"
                              : "opacity-80"
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Starred */}
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">
                      Starred Only
                    </label>
                    <Toggle
                      checked={showStarredOnly}
                      onChange={() => setShowStarredOnly(!showStarredOnly)}
                      aria-label="Show starred sessions only"
                    />
                  </div>
                </div>

                {/* Tab Count Range */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Tab Count
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={tabCountFilter.min}
                      onChange={(e) =>
                        setTabCountFilter({
                          ...tabCountFilter,
                          min: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-16 py-1 px-2 border border-gray-300 rounded-md text-sm"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={tabCountFilter.max}
                      onChange={(e) =>
                        setTabCountFilter({
                          ...tabCountFilter,
                          max: parseInt(e.target.value) || 100,
                        })
                      }
                      className="w-16 py-1 px-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Date Range
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateRangeFilter.from}
                      onChange={(e) =>
                        setDateRangeFilter({
                          ...dateRangeFilter,
                          from: e.target.value,
                        })
                      }
                      className="py-1 px-2 border border-gray-300 rounded-md text-sm"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="date"
                      value={dateRangeFilter.to}
                      onChange={(e) =>
                        setDateRangeFilter({
                          ...dateRangeFilter,
                          to: e.target.value,
                        })
                      }
                      className="py-1 px-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Session Action Bar */}
      {selectedSessions.length > 0 && (
        <div className="bg-primary bg-opacity-10 p-3 rounded-lg shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary">
                {selectedSessions.length} session
                {selectedSessions.length !== 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="passive"
                onClick={clearSelectedSessions}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  setMultiRestoreModal({
                    isOpen: true,
                    combineIntoOneWindow: false,
                  })
                }
              >
                Restore Selected
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Storage indicator */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Typography variant="h2">Storage Usage</Typography>
            <span className="text-sm text-gray-600">
              {formatFileSize(storageStatus.usedBytes, userLocale)} of{" "}
              {formatFileSize(storageStatus.totalBytes, userLocale)}
            </span>
          </div>

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
              {storageStatus.usedBytes > 0
                ? formatDateTime(Date.now(), userLocale)
                : "Never"}
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      <div className="space-y-8">
        {/* Auto-saved sessions */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <Typography variant="h2">Auto-Saved Sessions</Typography>
            <div className="flex items-center gap-2">
              <Button
                variant="passive"
                size="sm"
                onClick={loadUndoHistory}
                className="flex items-center gap-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.53 2.47a.75.75 0 0 1 0 1.06L4.81 8.25H15a6.75 6.75 0 0 1 0 13.5h-3a.75.75 0 0 1 0-1.5h3a5.25 5.25 0 1 0 0-10.5H4.81l4.72 4.72a.75.75 0 1 1-1.06 1.06l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 0 1 1.06 0Z"
                    clipRule="evenodd"
                  />
                </svg>
                Recently Deleted
              </Button>
              <Button
                variant="passive"
                size="sm"
                onClick={loadSnapshots}
                className="flex items-center gap-1"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <Typography variant="body">Loading sessions...</Typography>
            </div>
          ) : (
            <div>
              {getFilteredEntries().length > 0 ? (
                getFilteredEntries().map((entry) => {
                  // Get auto-saved (non-manually saved) snapshots
                  const autoSnapshots = entry.snapshots.filter(
                    (snapshot) => !snapshot.saved
                  );

                  if (autoSnapshots.length === 0) return null;

                  return (
                    <div key={entry.oopsWindowId} className="mb-6">
                      {autoSnapshots.map((snapshot) =>
                        renderSnapshotItem(entry, snapshot, false)
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Typography variant="body" className="text-gray-500">
                    {windowEntries.length > 0
                      ? "No auto-saved sessions match the current filters"
                      : "No auto-saved sessions available"}
                  </Typography>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saved sessions */}
        <div>
          <Typography variant="h2" className="mb-3">
            Saved Sessions
          </Typography>

          {isLoading ? (
            <div className="text-center py-8">
              <Typography variant="body">Loading sessions...</Typography>
            </div>
          ) : (
            <div>
              {getFilteredEntries().length > 0 ? (
                getFilteredEntries().map((entry) => {
                  // Get manually saved snapshots
                  const savedSnapshots = entry.snapshots.filter(
                    (snapshot) => snapshot.saved
                  );

                  if (savedSnapshots.length === 0) return null;

                  return (
                    <div key={entry.oopsWindowId} className="mb-6">
                      {savedSnapshots.map((snapshot) =>
                        renderSnapshotItem(entry, snapshot, true)
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Typography variant="body" className="text-gray-500">
                    {windowEntries.length > 0
                      ? "No saved sessions match the current filters"
                      : "No saved sessions available"}
                  </Typography>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Multi-Restore Modal */}
      <Modal
        isOpen={multiRestoreModal.isOpen}
        onClose={() =>
          setMultiRestoreModal({
            ...multiRestoreModal,
            isOpen: false,
          })
        }
        title="Restore Multiple Sessions"
      >
        <div className="space-y-4">
          <Typography variant="body">
            You've selected {selectedSessions.length} session
            {selectedSessions.length !== 1 ? "s" : ""} to restore. How would you
            like to restore them?
          </Typography>

          <div className="space-y-3">
            <div
              className="flex items-start gap-2 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
              onClick={() =>
                setMultiRestoreModal({
                  ...multiRestoreModal,
                  combineIntoOneWindow: false,
                })
              }
            >
              <input
                type="radio"
                id="separate-windows"
                checked={!multiRestoreModal.combineIntoOneWindow}
                onChange={() =>
                  setMultiRestoreModal({
                    ...multiRestoreModal,
                    combineIntoOneWindow: false,
                  })
                }
                className="mt-1"
              />
              <div>
                <label
                  htmlFor="separate-windows"
                  className="font-medium block mb-1 cursor-pointer"
                >
                  Restore in separate windows
                </label>
                <p className="text-sm text-gray-600">
                  Each session will be restored in its own window, preserving
                  the original layout of each.
                </p>
              </div>
            </div>

            <div
              className="flex items-start gap-2 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
              onClick={() =>
                setMultiRestoreModal({
                  ...multiRestoreModal,
                  combineIntoOneWindow: true,
                })
              }
            >
              <input
                type="radio"
                id="combine-windows"
                checked={multiRestoreModal.combineIntoOneWindow}
                onChange={() =>
                  setMultiRestoreModal({
                    ...multiRestoreModal,
                    combineIntoOneWindow: true,
                  })
                }
                className="mt-1"
              />
              <div>
                <label
                  htmlFor="combine-windows"
                  className="font-medium block mb-1 cursor-pointer"
                >
                  Combine into one window
                </label>
                <p className="text-sm text-gray-600">
                  All tabs from the selected sessions will be combined into a
                  single new window.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 gap-2">
            <Button
              variant="passive"
              size="sm"
              onClick={() =>
                setMultiRestoreModal({
                  ...multiRestoreModal,
                  isOpen: false,
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                handleMultiRestore(multiRestoreModal.combineIntoOneWindow)
              }
            >
              Restore Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* Tag Editor Modal */}
      <Modal
        isOpen={tagEditorState.isOpen}
        onClose={() => setTagEditorState({ ...tagEditorState, isOpen: false })}
        title="Edit Tags"
      >
        <div className="space-y-4">
          <TagSelector
            availableTags={allTags}
            selectedTags={tagEditorState.selectedTags}
            onTagToggle={(tagId) => {
              const { windowId, timestamp } = tagEditorState;
              handleTagToggle(windowId, timestamp, tagId);

              // Update the local state immediately for better UX
              setTagEditorState((prev) => {
                const selectedTags = prev.selectedTags.includes(tagId)
                  ? prev.selectedTags.filter((id) => id !== tagId)
                  : [...prev.selectedTags, tagId];

                return { ...prev, selectedTags };
              });
            }}
            onCreateTag={handleCreateTag}
          />
          <div className="flex justify-end pt-2">
            <Button
              variant="passive"
              size="sm"
              onClick={() =>
                setTagEditorState({ ...tagEditorState, isOpen: false })
              }
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          setConfirmDialog({ isOpen: false, windowId: "", timestamp: 0 })
        }
        onConfirm={() =>
          handleDelete(confirmDialog.windowId, confirmDialog.timestamp)
        }
        title="Delete Snapshot"
        message="Are you sure you want to delete this snapshot? This action cannot be undone."
      />

      {/* Undo Notification */}
      {undoState.show && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 z-50 min-w-[300px]">
          <div className="flex-grow">
            <p>Deleted "{undoState.snapshotName}"</p>
            <p className="text-sm text-gray-300">
              This will be permanent after 30 seconds
            </p>
          </div>
          <button
            onClick={handleUndo}
            className="bg-white text-gray-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-opacity-90"
          >
            Undo
          </button>
        </div>
      )}

      {/* Undo History Modal */}
      <Modal
        isOpen={undoHistoryModal.isOpen}
        onClose={() =>
          setUndoHistoryModal((prev) => ({ ...prev, isOpen: false }))
        }
        title="Recently Deleted Sessions"
      >
        <div className="space-y-4">
          {undoHistoryModal.isLoading ? (
            <div className="py-8 text-center">
              <Typography variant="body">
                Loading deleted sessions...
              </Typography>
            </div>
          ) : undoHistoryModal.items.length === 0 ? (
            <div className="py-8 text-center">
              <Typography variant="body">
                No recently deleted sessions available to restore
              </Typography>
              <p className="text-sm text-gray-500 mt-2">
                Deleted sessions can be recovered for 30 seconds after deletion
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                These sessions were recently deleted and can be recovered. They
                will automatically expire 30 seconds after deletion.
              </p>

              {undoHistoryModal.items.map((item) => {
                const timeLeft = Math.max(
                  0,
                  Math.floor((item.expiresAt - Date.now()) / 1000)
                );
                const snapshotName =
                  item.snapshot.customName || formatSnapshotName(item.snapshot);

                return (
                  <div
                    key={`${item.oopsWindowId}-${item.snapshot.timestamp}`}
                    className="border rounded-md p-3 bg-gray-50"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{snapshotName}</p>
                        <p className="text-sm text-gray-500">
                          {item.snapshot.tabs.length} tab
                          {item.snapshot.tabs.length !== 1 ? "s" : ""} • Expires
                          in {timeLeft} second{timeLeft !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={async () => {
                          await undoDelete(
                            item.oopsWindowId,
                            item.snapshot.timestamp
                          );
                          await loadSnapshots();

                          // Refresh undo history
                          loadUndoHistory();
                        }}
                      >
                        Restore
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
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
              Last updated:{" "}
              {formatDateTime(storageStats.lastUpdate, navigator.language)}
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
