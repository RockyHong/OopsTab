import React from "react";

type IconButtonVariant =
  | "primary"
  | "passive"
  | "danger"
  | "warning"
  | "secondary";
type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: React.ReactNode;
  className?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  variant = "passive",
  size = "md",
  children,
  className = "",
  ...props
}) => {
  const baseClasses =
    "rounded-full flex items-center justify-center transition-all";

  const variantClasses = {
    primary: "text-primary hover:bg-primary hover:bg-opacity-10",
    passive: "text-gray-600 hover:bg-gray-200",
    danger: "text-danger hover:bg-danger hover:bg-opacity-10",
    warning: "text-yellow-600 hover:bg-yellow-100",
    secondary: "text-gray-500 hover:bg-gray-100",
  };

  const sizeClasses = {
    sm: "p-1",
    md: "p-2",
    lg: "p-3",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default IconButton;
