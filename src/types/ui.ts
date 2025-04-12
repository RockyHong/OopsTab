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

// Typography variants
export type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body-lg"
  | "body"
  | "body-sm"
  | "caption";

// Typography colors
export type TypographyColor =
  | "primary"
  | "secondary"
  | "disabled"
  | "inverse"
  | "accent"
  | "danger";

// Font weights
export type FontWeight = "normal" | "medium" | "semibold" | "bold";

// Standard component props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}
