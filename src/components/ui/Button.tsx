import React from "react";
import { ButtonVariant, Size, BaseComponentProps } from "../../types/ui";
import { cn } from "../../utils/classnames";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    BaseComponentProps {
  variant?: ButtonVariant;
  size?: Size;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}) => {
  const variantClasses = {
    primary:
      "bg-primary text-white shadow-sm transition-all hover:bg-primary-dark",
    passive:
      "bg-gray-200 text-gray-700 shadow-sm transition-all hover:bg-gray-300",
    danger:
      "bg-danger text-white shadow-sm transition-all hover:bg-danger-dark",
  };

  const sizeClasses = {
    sm: "px-sm py-xs text-xs",
    md: "px-md py-sm text-sm",
    lg: "px-lg py-md text-base",
  };

  return (
    <button
      className={cn(
        "rounded-md font-medium",
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

export default Button;
