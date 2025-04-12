import React from "react";
import { BaseComponentProps, Size } from "../../types/ui";
import { cn } from "../../utils/classnames";

type ContainerSize = "sm" | "md" | "lg" | "xl" | "full";

interface LayoutProps extends BaseComponentProps {
  containerSize?: ContainerSize;
  spacing?: Size;
  withPadding?: boolean;
}

/**
 * Layout component for consistent page structures
 * Provides standard container widths and spacing
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  containerSize = "lg",
  spacing = "md",
  withPadding = true,
  className,
  ...props
}) => {
  const containerClasses = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-full",
  };

  const spacingClasses = {
    sm: "py-sm",
    md: "py-md",
    lg: "py-lg",
  };

  const paddingClasses = withPadding ? "px-md sm:px-lg" : "";

  return (
    <div
      className={cn(
        containerClasses[containerSize],
        spacingClasses[spacing],
        paddingClasses,
        "mx-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface SectionProps extends BaseComponentProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  spacing?: Size;
}

/**
 * Section component for consistent section layouts within pages
 */
export const Section: React.FC<SectionProps> = ({
  children,
  title,
  subtitle,
  spacing = "md",
  className,
  ...props
}) => {
  const spacingClasses = {
    sm: "mb-lg",
    md: "mb-xl",
    lg: "mb-2xl",
  };

  return (
    <section className={cn(spacingClasses[spacing], className)} {...props}>
      {title && (
        <div className="mb-md">
          <div className="text-heading-4 font-heading mb-xs">{title}</div>
          {subtitle && (
            <div className="text-body-sm text-text-secondary">{subtitle}</div>
          )}
        </div>
      )}
      {children}
    </section>
  );
};

export default Layout;
