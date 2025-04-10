import React from "react";
import Typography from "./Typography";

interface ListItemProps {
  title: string;
  subtitle?: string;
  metadata?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  metadata,
  onClick,
  icon,
  actions,
  className = "",
}) => {
  return (
    <div
      className={`flex items-center p-3 border-b border-gray-100 hover:bg-gray-50 ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onClick}
    >
      {icon && <div className="mr-3 text-gray-500">{icon}</div>}

      <div className="flex-1 min-w-0">
        <Typography
          variant="body"
          className="font-medium text-gray-900 truncate"
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography variant="caption" className="text-gray-500 truncate">
            {subtitle}
          </Typography>
        )}

        {metadata && (
          <Typography variant="caption" className="text-gray-400">
            {metadata}
          </Typography>
        )}
      </div>

      {actions && <div className="ml-2 flex items-center">{actions}</div>}
    </div>
  );
};

export default ListItem;
