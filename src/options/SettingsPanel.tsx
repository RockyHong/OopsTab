import React, { useState, useEffect, useRef } from "react";
import { Typography, Card, Button, Toggle, Modal } from "../components/ui";
import {
  getConfig,
  saveConfig,
  getStorageStats,
  updateStorageStats,
  checkStorageLimits,
  deleteAllSnapshots,
  exportSnapshots,
  importSnapshots,
} from "../utils";
import { OopsConfig, DEFAULT_CONFIG, DEFAULT_STORAGE_STATS } from "../types";
import { useNavigate } from "react-router-dom";
import { BeakerIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon, TrashIcon } from "@heroicons/react/24/solid";

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

  // Add states for import/export
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [exportedFilename, setExportedFilename] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete success modal state
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);

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

  // Delete Success Modal component
  const DeleteSuccessModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    count: number;
  }> = ({ isOpen, onClose, count }) => {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Snapshots Deleted">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <TrashIcon className="h-6 w-6 text-red-500 flex-shrink-0" />
            <Typography variant="body" className="mb-0">
              {count === 1
                ? "1 snapshot was successfully deleted."
                : `${count} snapshots were successfully deleted.`}
            </Typography>
          </div>

          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <Typography variant="body-sm" className="mb-0 text-text-secondary">
              Your storage has been cleared. You can continue to create new
              snapshots.
            </Typography>
          </div>

          <div className="flex justify-center pt-4 mt-2">
            <Button variant="primary" onClick={onClose} className="px-6">
              Got It
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  // Handle deleting all snapshots
  const handleDeleteAllSnapshots = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete ALL snapshots? This action cannot be undone."
      )
    ) {
      setIsLoading(true);
      try {
        // Save the count before deleting
        const count = storageStatus.itemCounts.windows;
        await deleteAllSnapshots();

        // Set delete success info
        setDeletedCount(count);
        setShowDeleteSuccess(true);

        // Reload storage stats after deletion
        await loadData();
      } catch (err) {
        console.error("Error deleting snapshots:", err);
        setStatusMessage("Error deleting snapshots. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Export Success Modal component
  const ExportSuccessModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    filename: string;
  }> = ({ isOpen, onClose, filename }) => {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Export Successful">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
            <Typography variant="body" className="mb-0">
              Your snapshots were successfully exported.
            </Typography>
          </div>

          {filename && (
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <Typography
                variant="body-sm"
                className="font-medium mb-1 text-text-secondary"
              >
                Exported to:
              </Typography>
              <Typography
                variant="body-sm"
                className="font-mono break-all text-text-primary mb-0"
              >
                {filename}
              </Typography>
            </div>
          )}

          <div className="flex justify-center pt-4 mt-2">
            <Button variant="primary" onClick={onClose} className="px-6">
              Got It
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  // Handle export functionality
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const jsonData = await exportSnapshots();

      // Use the File System Access API if supported
      if ("showSaveFilePicker" in window) {
        try {
          const filename = `oopstab-snapshots-${
            new Date().toISOString().split("T")[0]
          }.json`;

          // @ts-ignore - TypeScript might not have types for this API yet
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: "JSON Files",
                accept: {
                  "application/json": [".json"],
                },
              },
            ],
          });

          // Create a writable stream and write the file
          // @ts-ignore - TypeScript might not have types for this API yet
          const writable = await fileHandle.createWritable();
          await writable.write(jsonData);
          await writable.close();

          console.log("File saved successfully using File System Access API");

          // Show success modal with the actual filename (might be different from suggested)
          // @ts-ignore - TypeScript might not have types for this API yet
          const savedFilename = fileHandle.name || filename;
          setExportedFilename(savedFilename);
          setShowExportSuccess(true);
        } catch (err) {
          // User might have cancelled the save dialog
          console.warn("File System Access API operation failed:", err);

          // Check if this was a user cancellation or a real error
          // The error for cancellation is typically DOMException with name "AbortError"
          if (err instanceof DOMException && err.name === "AbortError") {
            console.log("User cancelled the save dialog");
            // Don't fall back to download in this case
          } else {
            // For other errors, fall back to the traditional download
            console.warn("Falling back to download due to error:", err);
            const savedFilename = downloadFile(jsonData);
            setExportedFilename(savedFilename);
            setShowExportSuccess(true);
          }
        }
      } else {
        // Fall back for browsers without File System Access API
        const savedFilename = downloadFile(jsonData);
        setExportedFilename(savedFilename);
        setShowExportSuccess(true);
      }
    } catch (err) {
      console.error("Error exporting snapshots:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Helper function for traditional file download
  const downloadFile = (jsonData: string): string => {
    const filename = `oopstab-snapshots-${
      new Date().toISOString().split("T")[0]
    }.json`;
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    return filename;
  };

  // Handle import functionality
  const handleImport = () => {
    // Clear any previous error
    setImportError("");

    // Trigger file input click
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Process the imported file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError("");

    try {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const jsonData = event.target?.result as string;
          if (!jsonData) {
            throw new Error("Failed to read file");
          }

          await importSnapshots(jsonData);

          // Reload storage stats to show the imported data
          await loadData();
        } catch (err) {
          console.error("Error importing snapshots:", err);
          setImportError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsImporting(false);
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };

      reader.onerror = () => {
        setImportError("Failed to read file");
        setIsImporting(false);
      };

      reader.readAsText(file);
    } catch (err) {
      console.error("Error reading file:", err);
      setImportError("Failed to read file");
      setIsImporting(false);
    }
  };

  return (
    <div className="content-container">
      <div className="flex justify-between items-center pb-6">
        <Typography variant="h2" className="text-primary">
          OopsTab Settings
        </Typography>

        {/* Only show debug button in development mode */}
        {process.env.NODE_ENV === "development" && (
          <Button
            variant="passive"
            onClick={() => navigate("/debug")}
            className="flex items-center space-x-1"
          >
            <BeakerIcon className="h-4 w-4" />
            <span>Debug Tools</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Snapshot Settings Card */}
        <Card className="border rounded-lg h-full flex flex-col">
          <div className="p-4 flex-grow flex flex-col">
            <Typography variant="h3" className="text-primary-dark mb-4">
              Snapshot Settings
            </Typography>

            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="autosaveDebounce"
                  className="block text-sm font-medium text-text-primary"
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
                  <div className="ml-2 text-sm text-text-secondary">
                    seconds
                  </div>
                </div>
                <p className="text-xs text-text-secondary">
                  Time to wait after tab changes before creating an
                  auto-snapshot (1-60 seconds)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="syncEnabled"
                    className="block text-sm font-medium text-text-primary"
                  >
                    Enable Sync
                  </label>
                  <Toggle
                    checked={config.syncEnabled}
                    onChange={(checked) =>
                      setConfig((prev) => ({
                        ...prev,
                        syncEnabled: checked,
                      }))
                    }
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  Synchronize snapshots across your devices using browser sync.
                  This will help preserve your snapshots if you reinstall the
                  extension.
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

            {/* Button container pushed to bottom */}
            <div className="pt-4 flex justify-between mt-auto">
              <Button
                variant="primary"
                onClick={saveSettings}
                disabled={isSaving || isLoading}
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
              <Button
                variant="passive"
                onClick={resetDefaults}
                disabled={isLoading}
              >
                Reset Defaults
              </Button>
            </div>
          </div>
        </Card>

        {/* Storage Management Card */}
        <Card className="border rounded-lg h-full flex flex-col">
          <div className="p-4 flex-grow flex flex-col">
            <Typography variant="h3" className="text-primary-dark mb-4">
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
                <div className="flex-grow">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-md text-center">
                      <div className="text-lg font-semibold text-primary">
                        {formatBytes(storageStatus.usedBytes)}
                      </div>
                      <div className="text-sm text-text-secondary">
                        Storage Usage
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-md text-center">
                      <div className="text-lg font-semibold text-primary">
                        {storageStatus.itemCounts.windows}
                      </div>
                      <div className="text-sm text-text-secondary">
                        Windows Snapshots
                      </div>
                    </div>
                  </div>

                  {/* Warning message if approaching limit */}
                  {storageStatus.isApproachingLimit &&
                    storageStatus.warningMessage && (
                      <div className="p-2 mt-3 rounded-md text-sm bg-yellow-100 text-yellow-800">
                        {storageStatus.warningMessage}
                      </div>
                    )}
                </div>

                {/* Import/Export Functionality */}
                <div className="pt-3 flex flex-wrap gap-2">
                  <Button
                    variant="passive"
                    onClick={handleExport}
                    disabled={
                      isExporting || storageStatus.itemCounts.windows === 0
                    }
                    title="Export snapshots to a file"
                  >
                    {isExporting ? "Exporting..." : "Export Snapshots"}
                  </Button>

                  <Button
                    variant="passive"
                    onClick={handleImport}
                    disabled={isImporting}
                    title="Import snapshots from a file"
                  >
                    {isImporting ? "Importing..." : "Import Snapshots"}
                  </Button>

                  {/* Hidden file input for import */}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    style={{ display: "none" }}
                  />
                </div>

                {/* Error message for import */}
                {importError && (
                  <div className="p-2 rounded-md text-sm bg-red-100 text-red-800">
                    Error importing snapshots: {importError}
                  </div>
                )}

                <div className="text-sm text-text-secondary">
                  <p>
                    OopsTab stores your window snapshots in browser storage,
                    which has limited space. Each window keeps only its most
                    recent state.
                  </p>
                  <ul className="list-disc pl-5 mt-2 text-xs text-gray-500">
                    <li>
                      Each window has one snapshot which gets updated
                      automatically
                    </li>
                    <li>
                      If storage usage is high, consider deleting snapshots that
                      are no longer needed
                    </li>
                    <li>
                      Use Export to backup your snapshots before clearing
                      storage
                    </li>
                  </ul>
                </div>

                {/* Button container pushed to bottom */}
                <div className="flex justify-end mt-auto pt-4">
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
          </div>
        </Card>
      </div>

      {/* About Section - moved outside the grid */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center">
        <div className="space-y-2 inline-block">
          <Typography variant="body-sm" className="italic text-text-caption">
            OopsTab is an open source project available on GitHub under MIT
            license.
          </Typography>

          <div className="flex flex-wrap justify-center items-center gap-4 pt-2">
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
                className="mr-1"
                viewBox="0 0 16 16"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </a>

            <span className="text-text-disabled">·</span>

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
                className="mr-1"
                viewBox="0 0 16 16"
              >
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
              </svg>
              Report Issue
            </a>

            <span className="text-text-disabled">·</span>

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
                className="mr-1"
                viewBox="0 0 16 16"
              >
                <path d="M3 2.5a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1 5 0v.006c0 .07 0 .27-.038.494H15a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2.038A3 3 0 0 1 3 2.506zm1.068.5H7v-.5a1.5 1.5 0 1 0-3 0c0 .085.002.274.045.43zM9 3h2.932l.023-.07c.043-.156.045-.345.045-.43a1.5 1.5 0 0 0-3 0zm6 4v7.5a1.5 1.5 0 0 1-1.5 1.5H9V7zM2.5 16A1.5 1.5 0 0 1 1 14.5V7h6v9z" />
              </svg>
              Buy me a coffee
            </a>

            <span className="text-text-disabled">·</span>

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
                className="mr-1"
                viewBox="0 0 16 16"
              >
                <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z" />
              </svg>
              Website
            </a>
          </div>
        </div>
      </div>

      {/* Export Success Modal */}
      <ExportSuccessModal
        isOpen={showExportSuccess}
        onClose={() => setShowExportSuccess(false)}
        filename={exportedFilename}
      />

      {/* Delete Success Modal */}
      <DeleteSuccessModal
        isOpen={showDeleteSuccess}
        onClose={() => setShowDeleteSuccess(false)}
        count={deletedCount}
      />
    </div>
  );
};

export default SettingsPanel;
