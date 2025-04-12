import React from "react";
import Typography from "./Typography";
import { cn } from "../../utils/classnames";

interface ListItemProps {
  title: React.ReactNode;
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
      className={cn(
        "flex items-center p-3 border-b border-gray-100 last:border-b-0",
        onClick && "cursor-pointer hover:bg-gray-50",
        className
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        {typeof title === "string" ? (
          <Typography
            variant="body"
            className="font-medium text-gray-900 truncate"
          >
            {title}
          </Typography>
        ) : (
          title
        )}

        {subtitle && (
          <Typography variant="caption" className="text-gray-500 truncate mt-1">
            {subtitle}
          </Typography>
        )}

        {metadata && (
          <Typography variant="caption" className="text-gray-400 mt-1">
            {metadata}
          </Typography>
        )}
      </div>

      {actions && (
        <div className="ml-2 flex items-center flex-shrink-0">{actions}</div>
      )}
    </div>
  );
};

export default ListItem;
