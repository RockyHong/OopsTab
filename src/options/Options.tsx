import React, { useState, useEffect } from "react";
import {
  Typography,
  Card,
  Button,
  Toggle,
  StorageIndicator,
  IconButton,
} from "../components/ui";
import {
  getConfig,
  saveConfig,
  OopsConfig,
  DEFAULT_CONFIG,
  getStorageStats,
  updateStorageStats,
  checkStorageLimits,
  DEFAULT_STORAGE_STATS,
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
      snapshots: 0,
      windows: 0,
      savedSnapshots: 0,
    },
  });
  const navigate = useNavigate();

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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Typography variant="h1" className="text-primary">
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

// Debug Page Navigation Component
const DebugView: React.FC = () => {
  const navigate = useNavigate();

  // Only render in development mode
  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Typography variant="h1" className="text-primary">
          Debug Tools Unavailable
        </Typography>
        <Card className="p-5 mt-6">
          <Typography variant="body">
            Debug tools are only available in development mode.
          </Typography>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => navigate("/")}
          >
            Back to Settings
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-6">
        <IconButton
          size="sm"
          variant="passive"
          onClick={() => navigate("/")}
          className="mr-2"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </IconButton>
        <Typography variant="h1" className="text-primary">
          Debug Tools
        </Typography>
      </div>
      <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mb-6">
        <Typography variant="body" className="text-sm text-yellow-800">
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
