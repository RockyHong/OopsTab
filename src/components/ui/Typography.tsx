import React from "react";
import {
  BaseComponentProps,
  TypographyVariant,
  TypographyColor,
  FontWeight,
} from "../../types/ui";
import { cn } from "../../utils/classnames";

interface TypographyProps extends BaseComponentProps {
  variant?: TypographyVariant;
  color?: TypographyColor;
  as?: React.ElementType;
  weight?: FontWeight;
}

const Typography: React.FC<TypographyProps> = ({
  variant = "body",
  color = "primary",
  children,
  className = "",
  as,
  weight,
  ...props
}) => {
  // Map variants to our design system classes
  const variantClasses = {
    h1: "text-heading-1",
    h2: "text-heading-2",
    h3: "text-heading-3",
    h4: "text-heading-4",
    h5: "text-heading-5",
    h6: "text-heading-6",
    "body-lg": "text-body-lg",
    body: "text-body",
    "body-sm": "text-body-sm",
    caption: "text-caption",
  };

  // Map heading variants to font-family
  const isFontHeading = variant?.startsWith("h");

  // Map colors to design system
  const colorClasses = {
    primary: "text-text-primary",
    secondary: "text-text-secondary",
    disabled: "text-text-disabled",
    inverse: "text-text-inverse",
    accent: "text-accent",
    danger: "text-danger",
  };

  // Font weights
  const weightClasses =
    weight &&
    {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    }[weight];

  // Default element mapping
  const variantElements = {
    h1: "h1",
    h2: "h2",
    h3: "h3",
    h4: "h4",
    h5: "h5",
    h6: "h6",
    "body-lg": "p",
    body: "p",
    "body-sm": "p",
    caption: "span",
  };

  const Element = as || variantElements[variant];

  return (
    <Element
      className={cn(
        variantClasses[variant],
        colorClasses[color],
        isFontHeading ? "font-heading" : "font-body",
        weightClasses,
        className
      )}
      {...props}
    >
      {children}
    </Element>
  );
};

export default Typography;
