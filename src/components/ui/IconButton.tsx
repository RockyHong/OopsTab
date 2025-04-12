import React from "react";
import { cn } from "../../utils/classnames";
import { Size, BaseComponentProps } from "../../types/ui";

type IconButtonVariant =
  | "primary"
  | "passive"
  | "danger"
  | "warning"
  | "secondary";

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    BaseComponentProps {
  variant?: IconButtonVariant;
  size?: Size;
}

const IconButton: React.FC<IconButtonProps> = ({
  variant = "passive",
  size = "md",
  children,
  className = "",
  ...props
}) => {
  const variantClasses = {
    primary: "text-primary hover:bg-primary hover:bg-opacity-10",
    passive: "text-gray-600 hover:bg-gray-200",
    danger: "text-danger hover:bg-danger hover:bg-opacity-10",
    warning: "text-yellow-600 hover:bg-yellow-100",
    secondary: "text-gray-500 hover:bg-gray-100",
  };

  const sizeClasses = {
    sm: "p-0.5 h-6 w-6",
    md: "p-1 h-8 w-8",
    lg: "p-1.5 h-10 w-10",
  };

  return (
    <button
      className={cn(
        "rounded-full flex items-center justify-center transition-all",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default IconButton;
