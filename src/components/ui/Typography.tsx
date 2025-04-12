import React from "react";

type TypographyVariant = "h1" | "h2" | "h4" | "body" | "caption";

interface TypographyProps {
  variant?: TypographyVariant;
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

const Typography: React.FC<TypographyProps> = ({
  variant = "body",
  children,
  className = "",
  as,
  ...props
}) => {
  const variantClasses = {
    h1: "text-xl font-heading font-semibold",
    h2: "text-lg font-heading font-medium",
    h4: "text-base font-heading font-medium",
    body: "text-sm font-body",
    caption: "text-xs font-body",
  };

  const variantElements = {
    h1: "h1",
    h2: "h2",
    h4: "h4",
    body: "p",
    caption: "span",
  };

  const Element = as || variantElements[variant];

  return (
    <Element className={`${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </Element>
  );
};

export default Typography;
