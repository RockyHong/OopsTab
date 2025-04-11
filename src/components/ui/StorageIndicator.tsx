import React from "react";
import Typography from "./Typography";

interface StorageIndicatorProps {
  percentUsed: number;
  isApproachingLimit: boolean;
  warningMessage?: string;
  usedBytes: number;
  totalBytes: number;
  className?: string;
}

const StorageIndicator: React.FC<StorageIndicatorProps> = ({
  percentUsed,
  isApproachingLimit,
  warningMessage,
  usedBytes,
  totalBytes,
  className = "",
}) => {
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

  // Determine color based on usage percentage
  const getBarColor = (): string => {
    if (percentUsed > 90) return "bg-red-500";
    if (percentUsed > 75) return "bg-yellow-500";
    if (percentUsed > 60) return "bg-orange-400";
    return "bg-primary";
  };

  // Get warning background color
  const getWarningBackground = (): string => {
    if (percentUsed > 90) return "bg-red-100 text-red-800";
    if (percentUsed > 75) return "bg-yellow-100 text-yellow-800";
    if (percentUsed > 60) return "bg-orange-100 text-orange-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Typography variant="body" className="text-sm font-medium">
          Storage Usage
        </Typography>
        <Typography variant="caption">
          {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
        </Typography>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()}`}
          style={{ width: `${percentUsed}%` }}
        ></div>
      </div>

      {/* Warning message if approaching limit */}
      {isApproachingLimit && warningMessage && (
        <div
          className={`mt-2 p-2 rounded-md text-sm ${getWarningBackground()}`}
        >
          {warningMessage}
        </div>
      )}
    </div>
  );
};

export default StorageIndicator;
