/**
 * Centralized UI types for OopsTab
 * As recommended in SoCGuide.md
 */

// Button variants
export type ButtonVariant = "primary" | "passive" | "danger";

// General sizes for UI components
export type Size = "sm" | "md" | "lg";

// Component-specific types
export type CardVariant = "default" | "highlighted" | "inactive";

// Theme colors based on our design system
export type ThemeColor =
  | "primary"
  | "secondary"
  | "accent"
  | "surface"
  | "danger";

// Standard component props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}
