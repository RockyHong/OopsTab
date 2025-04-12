/**
 * Utility for merging class names
 * Based on the clsx library recommended in the style guide
 */

import { ClassValue } from "../types";

/**
 * Merges multiple class names into a single string
 * Handles conditional classes, arrays, and objects
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter(Boolean)
    .map((input) => {
      if (typeof input === "string" || typeof input === "number") return input;
      if (!input) return "";

      return Object.entries(input)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key)
        .join(" ");
    })
    .join(" ");
}
