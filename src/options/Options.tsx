import React, { useState, useEffect } from "react";
import { Typography, Card, Button, Toggle, IconButton } from "../components/ui";
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

  return (
    <header className="app-header">
      <div className="header-content">
        <span className="header-logo">OopsTab</span>
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
