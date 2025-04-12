import React, { useState, useEffect } from "react";
import { Typography, Card, Button, Toggle, IconButton } from "../components/ui";
import {
  getConfig,
  saveConfig,
  OopsConfig,
  DEFAULT_CONFIG,
  getStorageStats,
  updateStorageStats,
  checkStorageLimits,
  DEFAULT_STORAGE_STATS,
  deleteAllSnapshots,
} from "../utils";
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import { BeakerIcon, ChevronLeftIcon } from "@heroicons/react/24/solid";

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
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <div className="flex justify-between items-center">
        <Typography variant="h2" className="text-primary">
          OopsTab Settings
        </Typography>

        {/* Only show debug button in development mode */}
        {process.env.NODE_ENV === "development" && (
          <Button
            variant="passive"
            size="sm"
            onClick={() => navigate("/debug")}
            className="flex items-center space-x-1"
          >
            <BeakerIcon className="h-4 w-4" />
            <span>Debug Tools</span>
          </Button>
        )}
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

            <div className="flex justify-end">
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteAllSnapshots}
                disabled={isLoading}
              >
                Delete All Snapshots
              </Button>
            </div>

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
          </div>
        )}
      </Card>

      {/* Snapshot Settings Card */}
      <Card>
        <div className="space-y-4">
          <div>
            <Typography variant="h3" className="mb-3">
              Snapshot Settings
            </Typography>

            {isLoading ? (
              <div className="p-3 text-center">
                <Typography variant="body">Loading settings...</Typography>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="autosaveDebounce"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Autosave Debounce (seconds)
                  </label>
                  <div className="flex items-center">
                    <input
                      id="autosaveDebounce"
                      type="number"
                      value={(config.autosaveDebounce / 1000).toFixed(1)}
                      onChange={(e) => {
                        const seconds = parseFloat(e.target.value);
                        if (!isNaN(seconds)) {
                          const milliseconds = Math.round(seconds * 1000);
                          handleInputChange(
                            {
                              target: { value: milliseconds.toString() },
                            } as React.ChangeEvent<HTMLInputElement>,
                            "autosaveDebounce",
                            1000,
                            60000
                          );
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                      min="1"
                      max="60"
                      step="0.1"
                    />
                    <div className="ml-2 text-sm text-gray-500">seconds</div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Time to wait after tab changes before creating an
                    auto-snapshot (1-60 seconds)
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

          <div className="pt-3 flex justify-between">
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

// Debug Page Navigation Component
const DebugView: React.FC = () => {
  const navigate = useNavigate();

  // Only render in development mode
  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <Typography variant="h2" className="text-primary">
          Debug Tools Unavailable
        </Typography>
        <Card className="mt-4">
          <Typography variant="body">
            Debug tools are only available in development mode.
          </Typography>
          <Button
            variant="primary"
            className="mt-3"
            onClick={() => navigate("/")}
          >
            Back to Settings
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <IconButton
          size="sm"
          variant="passive"
          onClick={() => navigate("/")}
          className="mr-2"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </IconButton>
        <Typography variant="h2" className="text-primary">
          Debug Tools
        </Typography>
      </div>
      <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mb-4">
        <Typography variant="body-sm" className="text-yellow-800">
          ⚠️ These tools are for development and testing purposes only. They are
          not available in production builds.
        </Typography>
      </div>
      {/* Render the imported debug panel */}
      <DebugPanel />
    </div>
  );
};

// Main Options component with routing
const Options: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SettingsPanel />} />
        <Route path="/debug" element={<DebugView />} />
      </Routes>
    </Router>
  );
};

export default Options;
