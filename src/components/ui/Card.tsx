import React from "react";
import { CardVariant, BaseComponentProps } from "../../types/ui";
import { cn } from "../../utils/classnames";

interface CardProps extends BaseComponentProps {
  variant?: CardVariant;
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = "default",
  hoverable = false,
  ...props
}) => {
  const variantClasses = {
    default: "bg-white rounded-lg shadow-card p-3 flex flex-col gap-3",
    highlighted:
      "bg-white rounded-lg shadow-card p-3 flex flex-col gap-3 border-l-4 border-primary",
    inactive:
      "bg-white rounded-lg shadow-card p-3 flex flex-col gap-3 opacity-70",
  };

  const hoverClasses = hoverable
    ? "hover:shadow-lg transition-shadow cursor-pointer"
    : "";

  return (
    <div
      className={cn(variantClasses[variant], hoverClasses, className)}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
