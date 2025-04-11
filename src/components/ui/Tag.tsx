import React from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface TagProps {
  id: string;
  label: string;
  color: string;
  onDelete?: () => void;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const Tag: React.FC<TagProps> = ({
  label,
  color,
  onDelete,
  onClick,
  className = "",
  size = "md",
}) => {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const baseStyle = {
    backgroundColor: `${color}15`, // Use color with 15% opacity
    color: color,
    borderColor: `${color}40`, // Use color with 40% opacity
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border ${
        sizeClasses[size]
      } font-medium cursor-pointer hover:bg-opacity-20 transition-colors ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      style={baseStyle}
      onClick={onClick}
    >
      <span className="truncate max-w-[150px]">{label}</span>
      {onDelete && (
        <button
          type="button"
          className={`ml-1 rounded-full hover:bg-gray-200 hover:bg-opacity-30 ${
            size === "sm" ? "p-0.5" : "p-1"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <XMarkIcon
            className={size === "sm" ? "h-3 w-3" : "h-4 w-4"}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
};

export default Tag;
