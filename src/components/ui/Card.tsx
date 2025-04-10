import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "highlighted" | "inactive";
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = "default",
  hoverable = false,
  ...props
}) => {
  const baseClasses = "card";

  const variantClasses = {
    default: "",
    highlighted: "border-l-4 border-primary",
    inactive: "opacity-70",
  };

  const hoverClasses = hoverable
    ? "hover:shadow-lg transition-shadow cursor-pointer"
    : "";

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${hoverClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
