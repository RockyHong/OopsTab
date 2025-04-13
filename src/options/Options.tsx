import React, { useState, useEffect } from "react";
import {
  Typography,
  Card,
  Button,
  Toggle,
  IconButton,
  Modal,
} from "../components/ui";
import {
  getConfig,
  saveConfig,
  getStorageStats,
  updateStorageStats,
  checkStorageLimits,
  deleteAllSnapshots,
} from "../utils";
import { OopsConfig, DEFAULT_CONFIG, DEFAULT_STORAGE_STATS } from "../types";
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  BeakerIcon,
  ChevronLeftIcon,
  Cog6ToothIcon,
  HomeIcon,
} from "@heroicons/react/24/solid";
import OopsTab from "../pages/oopstab/OopsTab";
import browser from "../utils/browserAPI";

// Import DebugPanel conditionally only in development mode
const DebugPanel =
  process.env.NODE_ENV === "development"
    ? require("../pages/oopstab/DebugPanel").default
    : () => null;

// Main Settings component
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
      windows: 0,
    },
  });
  const navigate = useNavigate();

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

  // Load configuration and storage status
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

  // Load data on mount
  useEffect(() => {
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

  // Handle deleting all snapshots
  const handleDeleteAllSnapshots = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete ALL snapshots? This action cannot be undone."
      )
    ) {
      setIsLoading(true);
      setStatusMessage("");
      try {
        await deleteAllSnapshots();
        setStatusMessage("All snapshots deleted successfully!");
        // Reload storage stats after deletion
        await loadData();
      } catch (err) {
        console.error("Error deleting snapshots:", err);
        setStatusMessage("Error deleting snapshots. Please try again.");
      } finally {
        // Keep isLoading true until loadData finishes
        // setIsLoading(false);
      }
    }
  };

  return (
    <div className="page-content-wrapper">
      <div className="page-header">
        <Typography variant="h2" className="text-primary">
          OopsTab Settings
        </Typography>
      </div>

      {/* Storage Management Card */}
      <Card>
        <Typography variant="h3" className="mb-3">
          Storage Management
        </Typography>

        {isLoading ? (
          <div className="p-3 text-center">
            <Typography variant="body">
              Loading storage information...
            </Typography>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded-md text-center">
                <div className="text-lg font-semibold text-primary">
                  {formatBytes(storageStatus.usedBytes)}
                </div>
                <div className="text-xs text-gray-500">Storage Usage</div>
              </div>

              <div className="bg-gray-50 p-3 rounded-md text-center">
                <div className="text-lg font-semibold text-primary">
                  {storageStatus.itemCounts.windows}
                </div>
                <div className="text-xs text-gray-500">Windows Snapshots</div>
              </div>
            </div>

            {/* Warning message if approaching limit */}
            {storageStatus.isApproachingLimit &&
              storageStatus.warningMessage && (
                <div className="p-2 rounded-md text-sm bg-yellow-100 text-yellow-800">
                  {storageStatus.warningMessage}
                </div>
              )}

            <div className="text-sm text-gray-600">
              <p>
                OopsTab stores your window snapshots in browser storage, which
                has limited space. Each window keeps only its most recent state.
              </p>
              <ul className="list-disc pl-5 mt-2 text-xs text-gray-500">
                <li>
                  Each window has one snapshot which gets updated automatically
                </li>
                <li>
                  If storage usage is high, consider closing unused windows
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button
                variant="danger"
                onClick={handleDeleteAllSnapshots}
                disabled={isLoading}
              >
                Delete All Snapshots
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

const Navigation: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isAboutPopupOpen, setIsAboutPopupOpen] = useState(false);

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

  const openAboutPopup = () => {
    setIsAboutPopupOpen(true);
  };

  const closeAboutPopup = () => {
    setIsAboutPopupOpen(false);
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="flex items-baseline space-x-2">
          <span className="header-logo">OopsTab</span>
          <span className="text-xs text-accent">
            by{" "}
            <span
              className="cursor-pointer hover:underline"
              onClick={openAboutPopup}
            >
              <u>Rocky Hong</u>
            </span>
          </span>
        </div>
        <nav className="header-nav">
          <Link to="/">
            <button
              className={`header-nav-button ${
                currentPath === "/" ? "header-nav-button-active" : ""
              }`}
              aria-label="Home"
            >
              <HomeIcon className="h-5 w-5" />
            </button>
          </Link>
          <Link to="/settings">
            <button
              className={`header-nav-button ${
                currentPath === "/settings" ? "header-nav-button-active" : ""
              }`}
              aria-label="Settings"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
          </Link>
          {process.env.NODE_ENV === "development" && (
            <Link to="/debug">
              <button
                className={`header-nav-button ${
                  currentPath === "/debug" ? "header-nav-button-active" : ""
                }`}
                aria-label="Debug"
              >
                <BeakerIcon className="h-5 w-5" />
              </button>
            </Link>
          )}
        </nav>
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
                <path d="M3 2.5a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1 5 0v.006c0 .07 0 .27-.038.494H15a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2.038A3 3 0 0 1 3 2.506zm1.068.5H7v-.5a1.5 1.5 0 1 0-3 0c0 .085.002.274.045.43zM9 3h2.932l.023-.07c.043-.156.045-.345.045-.43a1.5 1.5 0 0 0-3 0zm6 4v7.5a1.5 1.5 0 0 1-1.5 1.5H9V7zM2.5 16A1.5 1.5 0 0 1 1 14.5V7h6v9z" />
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
    </header>
  );
};

// Debug View Component
const DebugView: React.FC = () => {
  // Only render in development mode
  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="page-content-wrapper">
        <div className="page-header">
          <Typography variant="h2" className="text-primary">
            Debug Tools Unavailable
          </Typography>
        </div>
        <p className="mt-4">
          Debug tools are only available in development mode.
        </p>
      </div>
    );
  }

  return <DebugPanel />;
};

// Main Options component with routing
const Options: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Navigation />
        <main className="content-container">
          <Routes>
            <Route path="/" element={<OopsTab />} />
            <Route path="/settings" element={<SettingsPanel />} />
            <Route path="/debug" element={<DebugView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default Options;
