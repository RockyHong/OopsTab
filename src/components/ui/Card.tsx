import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "highlighted" | "inactive";
  hoverable?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const Card: React.FC<CardProps & React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  variant = "default",
  hoverable = false,
  ...props
}) => {
  const baseClasses = "rounded-lg shadow-md bg-white";

  const variantClasses = {
    default: "",
    highlighted: "border-l-4 border-primary",
    inactive: "opacity-70",
  };

  const hoverClasses =
    hoverable || props.onClick
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
