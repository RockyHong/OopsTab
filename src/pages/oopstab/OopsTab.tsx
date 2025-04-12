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
// Import background image - this might need to be adjusted based on your project setup
// import rockyHongGif from '../../assets/images/rocky-hong-gif.gif'; // This won't work in extensions

// CSS Animation for checkbox highlighting
const checkboxHighlightKeyframes = `
@keyframes checkboxHighlight {
  0% { 
    background-color: rgba(34, 197, 94, 0.8);
    opacity: 1;
  }
  100% { 
    background-color: rgba(34, 197, 94, 0);
    opacity: 1;
  }
}

.animate-checkbox-highlight {
  animation: checkboxHighlight 0.3s ease-out;
  position: relative;
}

.animate-checkbox-highlight::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(34, 197, 94, 0.8);
  border-radius: 0.25rem;
  animation: checkboxHighlight 0.3s ease-out forwards;
  pointer-events: none;
  z-index: 1;
}
`;

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
  const [isAboutPopupOpen, setIsAboutPopupOpen] = useState(false);

  const openAboutPopup = () => {
    setIsAboutPopupOpen(true);
  };

  const closeAboutPopup = () => {
    setIsAboutPopupOpen(false);
  };

  // Try to load the GIF using the browser API
  const gifUrl = (() => {
    try {
      const url = browser.runtime.getURL("assets/images/rocky-hong-gif.gif");
      console.log("Attempting to load image from:", url);
      return url;
    } catch (e) {
      console.error("Error loading GIF:", e);
      // Fallback to a static path as last resort
      const fallbackUrl = chrome.runtime.getURL
        ? chrome.runtime.getURL("assets/images/rocky-hong-gif.gif")
        : "/assets/images/rocky-hong-gif.gif";
      console.log("Using fallback URL:", fallbackUrl);
      return fallbackUrl;
    }
  })();

  return (
    <div className="content-container">
      <div className="flex flex-col items-center mb-4">
        <Typography
          variant="h1"
          className="text-primary text-3xl font-bold mb-1"
        >
          OopsTab
        </Typography>
        <div className="text-xs text-gray-500">
          by{" "}
          <span
            className="cursor-pointer hover:underline"
            onClick={openAboutPopup}
          >
            Rocky Hong
          </span>
        </div>
      </div>

      {/* About popup */}
      <Modal isOpen={isAboutPopupOpen} onClose={closeAboutPopup}>
        <div className="space-y-4">
          {/* Add overflow-hidden and rounded-t-lg to clip the image to the modal's top corners */}
          <div className="-mt-6 -mx-6 mb-4 overflow-hidden rounded-t-lg">
            <img
              src={gifUrl}
              alt="Rocky Hong"
              className="w-full h-auto object-cover block"
              onError={(e) => {
                console.error("Failed to load image:", e.currentTarget.src);
                // Instead of hiding, show a colored background with text
                const target = e.currentTarget;
                target.style.display = "none";

                // Create a fallback div with gradient background
                const parent = target.parentElement;
                if (parent) {
                  // Remove existing fallback if present
                  const existingFallback = parent.querySelector(
                    ".fallback-placeholder"
                  );
                  if (existingFallback) {
                    parent.removeChild(existingFallback);
                  }

                  const fallbackDiv = document.createElement("div");
                  fallbackDiv.className =
                    "fallback-placeholder w-full h-40 flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-xl";

                  const textSpan = document.createElement("span");
                  textSpan.className =
                    "absolute inset-0 flex items-center justify-center";
                  textSpan.textContent = "OopsTab";
                  fallbackDiv.appendChild(textSpan);

                  parent.appendChild(fallbackDiv);
                }
              }}
            />
          </div>

          <Typography variant="body">
            OopsTab is an open source browser extension developed by Rocky Hong.
          </Typography>

          <div className="space-y-2">
            <a
              href="https://github.com/RockyHong/OopsTab"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="mr-2"
                viewBox="0 0 16 16"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub: github.com/RockyHong/OopsTab
            </a>

            <a
              href="https://rockyhong.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="mr-2"
                viewBox="0 0 16 16"
              >
                <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z" />
              </svg>
              Website: rockyhong.com
            </a>

            <a
              href="https://buymeacoffee.com/rockyhong"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="mr-2"
                viewBox="0 0 16 16"
              >
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
              </svg>
              Buy me a coffee: buymeacoffee.com/rockyhong
            </a>

            <a
              href="https://github.com/RockyHong/OopsTab/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="mr-2"
                viewBox="0 0 16 16"
              >
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
              </svg>
              Bug Report: github.com/RockyHong/OopsTab/issues
            </a>
          </div>

          <Typography variant="body" className="text-center text-gray-600 mt-4">
            Thank you for using this extension!
          </Typography>
        </div>
      </Modal>

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

// Merge Confirmation Dialog component
const MergeConfirmationDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirmNew: () => void;
  onConfirmReplace: () => void;
  selectedCount: number;
}> = ({ isOpen, onClose, onConfirmNew, onConfirmReplace, selectedCount }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge Snapshots">
      <div className="space-y-4">
        <Typography variant="body">
          You are about to merge {selectedCount} snapshots. How would you like
          to merge them?
        </Typography>
        <div className="flex justify-end space-x-3 pt-2">
          <Button variant="primary" onClick={onConfirmNew} size="sm">
            Create New
          </Button>
          <Button variant="passive" onClick={onConfirmReplace} size="sm">
            Replace (Merge into first selected)
          </Button>
          <Button variant="passive" onClick={onClose} size="sm">
            Cancel
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
      {visibleItems.map((item, itemIndex) => {
        if (item.type === "group") {
          const group = item.data as {
            id: number;
            name: string;
            color: string;
            tabs: TabData[];
          };
          return (
            <div
              key={`group-${group.id}-${itemIndex}`}
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
                  key={`group-tab-${group.id}-${itemIndex}-0`}
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
              key={`tab-${tab.id || tab.index}-${itemIndex}`}
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

  // Bulk action states
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSnapshots, setSelectedSnapshots] = useState<Set<string>>(
    new Set()
  );
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  // Add new state to track animation
  const [checkboxAnimation, setCheckboxAnimation] = useState(false);

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
    isBulkDelete: false,
  });

  // Inject animation CSS
  useEffect(() => {
    // Create style element for checkbox animation
    const styleElement = document.createElement("style");
    styleElement.innerHTML = checkboxHighlightKeyframes;
    document.head.appendChild(styleElement);

    // Clean up on unmount
    return () => {
      styleElement.remove();
    };
  }, []);

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

  // Handle bulk restore
  const handleBulkRestore = async () => {
    for (const oopsWindowId of selectedSnapshots) {
      await handleRestore(oopsWindowId);
    }
    // Exit select mode after operation
    setIsSelectMode(false);
    setSelectedSnapshots(new Set());
  };

  // Handle snapshot deletion
  const handleDelete = async (oopsWindowId: string) => {
    // Open confirmation dialog instead of using browser's confirm
    setConfirmDialog({
      isOpen: true,
      windowId: oopsWindowId,
      isBulkDelete: false,
    });
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    setConfirmDialog({
      isOpen: true,
      windowId: "",
      isBulkDelete: true,
    });
  };

  // Actual deletion after confirmation
  const confirmDelete = async () => {
    if (confirmDialog.isBulkDelete) {
      // Bulk delete
      try {
        for (const windowId of selectedSnapshots) {
          await deleteSnapshot(windowId);
        }
        console.log(`Successfully deleted ${selectedSnapshots.size} snapshots`);
        // Refresh the list
        loadSnapshots();
      } catch (err) {
        console.error("Error deleting snapshots:", err);
      } finally {
        // Close the dialog and exit select mode
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setIsSelectMode(false);
        setSelectedSnapshots(new Set());
      }
    } else {
      // Single delete
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
    }
  };

  // Handle merge snapshots
  const handleMerge = () => {
    if (selectedSnapshots.size < 2) {
      alert("Please select at least 2 snapshots to merge");
      return;
    }
    setShowMergeConfirm(true);
  };

  // Update merge snapshots logic to correctly handle the Replace option
  const mergeSnapshots = async (createNew: boolean) => {
    try {
      // Get all selected snapshots
      const selectedSnapshotObjects: WindowSnapshot[] = [];
      const snapshotIds = Array.from(selectedSnapshots);

      for (const id of snapshotIds) {
        if (snapshots[id]) {
          selectedSnapshotObjects.push(snapshots[id]);
        }
      }

      // Sort by number of tabs (descending)
      selectedSnapshotObjects.sort(
        (a, b) => (b.tabs?.length || 0) - (a.tabs?.length || 0)
      );

      // Base snapshot to get properties from
      const baseSnapshot = selectedSnapshotObjects[0];
      // Always generate a new window ID for both modes
      const targetWindowId = `oops-window-${Date.now()}`;

      // Create a new snapshot with appropriate name and data
      let newSnapshot: WindowSnapshot = {
        ...baseSnapshot,
        timestamp: Date.now(),
        tabs: [],
        groups: [],
      };

      // Set appropriate custom name based on mode
      if (createNew) {
        newSnapshot.customName = "Merged Snapshot";
      } else {
        // When replacing, use the base snapshot's name
        newSnapshot.customName =
          baseSnapshot.customName ||
          baseSnapshot.tabs?.[0]?.title ||
          "Merged: Multiple Windows";
      }

      // Ensure tabs array exists
      if (!newSnapshot.tabs) newSnapshot.tabs = [];
      if (!newSnapshot.groups) newSnapshot.groups = [];

      // Combine all tabs and groups
      const allTabs: TabData[] = [];
      const allGroups: TabGroupData[] = [];
      const existingGroupIds = new Set<number>();

      // Process all selected snapshots
      for (const snapshot of selectedSnapshotObjects) {
        if (snapshot.tabs && Array.isArray(snapshot.tabs)) {
          // For tabs, we need to update their indices
          const startIndex = allTabs.length;
          snapshot.tabs.forEach((tab, idx) => {
            allTabs.push({
              ...tab,
              index: startIndex + idx,
            });
          });

          // For groups, we need to avoid ID conflicts
          if (snapshot.groups && Array.isArray(snapshot.groups)) {
            snapshot.groups.forEach((group) => {
              if (!existingGroupIds.has(group.id)) {
                allGroups.push(group);
                existingGroupIds.add(group.id);
              } else {
                // Generate a new ID for this group
                const newId = Math.max(...Array.from(existingGroupIds)) + 1;
                allGroups.push({
                  ...group,
                  id: newId,
                });
                existingGroupIds.add(newId);

                // Update group IDs in tabs
                allTabs.forEach((tab) => {
                  if (tab.groupId === group.id) {
                    tab.groupId = newId;
                  }
                });
              }
            });
          }
        }
      }

      // Save the merged snapshot
      newSnapshot.tabs = allTabs;
      newSnapshot.groups = allGroups;

      // Store in local storage
      const result = await browser.storage.local.get(["oopsSnapshots"]);
      const storedSnapshots = (result.oopsSnapshots || {}) as SnapshotMap;

      // Add the new merged snapshot
      storedSnapshots[targetWindowId] = newSnapshot;

      // If replacing, delete ALL selected snapshots
      if (!createNew) {
        // Remove ALL original snapshots when replacing
        for (const id of snapshotIds) {
          delete storedSnapshots[id];
        }
      }

      await browser.storage.local.set({ oopsSnapshots: storedSnapshots });

      console.log("Successfully merged snapshots");
      loadSnapshots();
    } catch (err) {
      console.error("Error merging snapshots:", err);
    } finally {
      setShowMergeConfirm(false);
      setIsSelectMode(false);
      setSelectedSnapshots(new Set());
    }
  };

  // Toggle snapshot selection
  const toggleSnapshotSelection = (oopsWindowId: string) => {
    setSelectedSnapshots((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(oopsWindowId)) {
        newSet.delete(oopsWindowId);
      } else {
        newSet.add(oopsWindowId);
      }
      return newSet;
    });
  };

  // Toggle select mode with animation hint
  const toggleSelectMode = () => {
    setIsSelectMode(true);
    setCheckboxAnimation(true);
    // Turn off animation after it completes
    setTimeout(() => setCheckboxAnimation(false), 300);
  };

  // Cancel selection mode
  const cancelSelectMode = () => {
    setIsSelectMode(false);
    setSelectedSnapshots(new Set());
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
      <div className="flex items-center space-x-1">
        <Typography
          variant="body"
          className="font-medium text-gray-900 truncate mr-1 mb-0 leading-tight"
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
          className="opacity-50 hover:opacity-100 flex-shrink-0"
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
    snapshot: WindowSnapshot,
    index: number
  ) => {
    const isCurrentlyOpen = openWindows.has(oopsWindowId);
    const isSelected = selectedSnapshots.has(oopsWindowId);

    // Defensive check to make sure snapshot.tabs exists
    if (!snapshot || !snapshot.tabs || !Array.isArray(snapshot.tabs)) {
      return (
        <ListItem
          key={`${oopsWindowId}-error-${index}`}
          title="Error: Invalid snapshot data"
          subtitle="This snapshot appears to be corrupted"
          metadata={
            snapshot?.timestamp
              ? formatDate(snapshot.timestamp)
              : "Unknown time"
          }
          actions={
            isSelectMode ? (
              <div className="flex items-center justify-center h-full">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSnapshotSelection(oopsWindowId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${
                    checkboxAnimation ? "animate-checkbox-highlight" : ""
                  }`}
                />
              </div>
            ) : (
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
            )
          }
          className="hover:bg-blue-50 transition-colors duration-150 border-b border-gray-200 last:border-b-0"
        />
      );
    }

    return (
      <ListItem
        key={`${oopsWindowId}-${snapshot.timestamp}-${index}`}
        title={
          <div className={isSelectMode && isSelected ? "opacity-80" : ""}>
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
          isSelectMode ? (
            <div
              className="flex items-center justify-center h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSnapshotSelection(oopsWindowId);
                }}
                onClick={(e) => e.stopPropagation()}
                className={`h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${
                  checkboxAnimation ? "animate-checkbox-highlight" : ""
                }`}
              />
            </div>
          ) : (
            <div className="flex space-x-1">
              <IconButton
                size="sm"
                variant={snapshot.isStarred ? "warning" : "passive"}
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
          )
        }
        className={`hover:bg-blue-50 transition-colors duration-150 border-b border-gray-200 last:border-b-0 ${
          isSelectMode && isSelected ? "bg-blue-50" : ""
        }`}
        onClick={
          isSelectMode ? () => toggleSnapshotSelection(oopsWindowId) : undefined
        }
      />
    );
  };

  return (
    <div className="page-content-wrapper">
      {/* Title row - sticky with background */}
      <div className="page-header">
        <Typography variant="h2" className="text-primary">
          Window Snapshots
        </Typography>

        {/* Action buttons aligned within title row */}
        <div className="flex items-center space-x-2">
          {isSelectMode ? (
            <>
              <Button
                variant="danger"
                onClick={handleBulkDelete}
                disabled={selectedSnapshots.size === 0}
              >
                Delete ({selectedSnapshots.size})
              </Button>
              <Button
                variant="primary"
                onClick={handleBulkRestore}
                disabled={selectedSnapshots.size === 0}
              >
                Open ({selectedSnapshots.size})
              </Button>
              <Button
                variant="passive"
                onClick={handleMerge}
                disabled={selectedSnapshots.size < 2}
              >
                Merge ({selectedSnapshots.size})
              </Button>
              <Button variant="passive" onClick={cancelSelectMode}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="passive"
                onClick={toggleSelectMode}
                title="Select snapshots for bulk actions"
              >
                Select
              </Button>
              <IconButton
                variant="primary"
                onClick={loadSnapshots}
                disabled={isLoading}
                title="Refresh Snapshots"
              >
                <ArrowPathIcon
                  className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
                />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {/* Snapshots */}
      <div className="space-y-4">
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

              // Render components
              const sections = [];

              // Starred Snapshots Card
              if (grouped.starred.length > 0) {
                const visibleStarredItems = showAllStarred
                  ? grouped.starred
                  : grouped.starred.slice(0, 3);

                sections.push(
                  <div key="starred-section" className="space-y-2">
                    <div className="snapshot-section-header">
                      <Typography
                        variant="h4"
                        className="font-semibold flex items-center text-primary-dark"
                      >
                        <StarIcon className="h-4 w-4 text-yellow-500 mr-1.5" />
                        Starred Snapshots
                      </Typography>
                    </div>
                    <Card className="p-0 overflow-hidden border rounded-lg">
                      {visibleStarredItems.map(([id, snapshot], index) =>
                        renderSnapshotItem(id, snapshot, index)
                      )}

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
                  </div>
                );
              } else if (
                grouped.today.length > 0 ||
                grouped.yesterday.length > 0 ||
                Object.keys(grouped.older).length > 0
              ) {
                // Show explainer about starring if we have snapshots but none are starred
                sections.push(
                  <Card key="star-explainer" className="p-4 bg-blue-50">
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

              // Today snapshots card
              if (grouped.today.length > 0) {
                const visibleTodayItems = grouped.today.slice(0, visibleToday);
                const hasMoreToday =
                  grouped.today.length > visibleTodayItems.length;

                sections.push(
                  <div key="today-section" className="space-y-2">
                    <div className="snapshot-section-header">
                      <Typography
                        variant="h4"
                        className="font-semibold flex items-center text-primary-dark"
                      >
                        <ClockSolidIcon className="h-4 w-4 text-primary mr-1.5" />
                        Today
                      </Typography>
                    </div>
                    <Card className="p-0 overflow-hidden border rounded-lg">
                      {visibleTodayItems.map(([id, snapshot], index) =>
                        renderSnapshotItem(id, snapshot, index)
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

                      {/* Load more trigger for today */}
                      {hasMoreToday && (
                        <div
                          ref={loadMoreTriggerRef}
                          className="h-4 opacity-0 -mb-4"
                        />
                      )}
                    </Card>
                  </div>
                );
              }

              // Yesterday snapshots card
              if (grouped.yesterday.length > 0) {
                const visibleYesterdayItems = grouped.yesterday.slice(
                  0,
                  visibleYesterday
                );
                const hasMoreYesterday =
                  grouped.yesterday.length > visibleYesterdayItems.length;

                sections.push(
                  <div key="yesterday-section" className="space-y-2">
                    <div className="snapshot-section-header">
                      <Typography
                        variant="h4"
                        className="font-semibold flex items-center text-primary-dark"
                      >
                        <ClockSolidIcon className="h-4 w-4 text-primary mr-1.5" />
                        Yesterday
                      </Typography>
                    </div>
                    <Card className="p-0 overflow-hidden border rounded-lg">
                      {visibleYesterdayItems.map(([id, snapshot], index) =>
                        renderSnapshotItem(id, snapshot, index)
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

                      {/* Load more trigger for yesterday */}
                      {hasMoreYesterday && (
                        <div
                          ref={loadMoreTriggerRef}
                          className="h-4 opacity-0 -mb-4"
                        />
                      )}
                    </Card>
                  </div>
                );
              }

              // Older dates as separate cards
              if (Object.keys(grouped.older).length > 0) {
                // Sort the dates (newest first)
                const sortedDates = Object.keys(grouped.older).sort((a, b) => {
                  const dateA = new Date(a);
                  const dateB = new Date(b);
                  return dateB.getTime() - dateA.getTime();
                });

                // Create a card for each date
                sortedDates.forEach((date) => {
                  const olderSnapshots = grouped.older[date];
                  const dateKey = `older-${date}`;
                  const isDateVisible = visibleOlderDates.has(date);
                  const visibleCount = visibleOlderItems[date] || 5;

                  // If this date isn't in the visible set yet, add it
                  useEffect(() => {
                    if (
                      olderSnapshots.length > 0 &&
                      !visibleOlderDates.has(date)
                    ) {
                      setVisibleOlderDates((prev) => {
                        const newSet = new Set(prev);
                        newSet.add(date);
                        return newSet;
                      });
                      setVisibleOlderItems((prev) => ({
                        ...prev,
                        [date]: 5, // Start with 5 items
                      }));
                    }
                  }, [date, olderSnapshots.length]);

                  if (isDateVisible) {
                    const visibleItems = olderSnapshots.slice(0, visibleCount);
                    const hasMoreItems =
                      olderSnapshots.length > visibleItems.length;

                    sections.push(
                      <div key={dateKey} className="space-y-2">
                        <div className="snapshot-section-header">
                          <Typography
                            variant="h4"
                            className="font-semibold flex items-center text-primary-dark"
                          >
                            <ClockSolidIcon className="h-4 w-4 text-primary mr-1.5" />
                            {date}
                          </Typography>
                        </div>
                        <Card className="p-0 overflow-hidden border rounded-lg">
                          {visibleItems.map(([id, snapshot], index) =>
                            renderSnapshotItem(id, snapshot, index)
                          )}
                          {hasMoreItems && (
                            <div className="p-2 bg-gray-50 border-t border-gray-200 text-center">
                              <Typography
                                variant="caption"
                                className="text-gray-500"
                              >
                                Scroll to load more (
                                {olderSnapshots.length - visibleItems.length}{" "}
                                remaining)
                              </Typography>
                            </div>
                          )}

                          {/* Load more trigger for this date */}
                          {hasMoreItems && (
                            <div
                              ref={loadMoreTriggerRef}
                              className="h-4 opacity-0 -mb-4"
                            />
                          )}
                        </Card>
                      </div>
                    );
                  }
                });
              }

              // Final load more trigger
              sections.push(
                <div
                  key="load-more-trigger"
                  ref={loadMoreTriggerRef}
                  className="h-4 opacity-0"
                />
              );

              return sections;
            })()}
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={confirmDelete}
        title={
          confirmDialog.isBulkDelete ? "Delete Snapshots" : "Delete Snapshot"
        }
        message={
          confirmDialog.isBulkDelete
            ? `Are you sure you want to delete ${selectedSnapshots.size} snapshots? This action cannot be undone.`
            : "Are you sure you want to delete this snapshot? This action cannot be undone."
        }
      />

      {/* Merge Confirmation Dialog */}
      <MergeConfirmationDialog
        isOpen={showMergeConfirm}
        onClose={() => setShowMergeConfirm(false)}
        onConfirmNew={() => mergeSnapshots(true)}
        onConfirmReplace={() => mergeSnapshots(false)}
        selectedCount={selectedSnapshots.size}
      />
    </div>
  );
};

export default OopsTab;
