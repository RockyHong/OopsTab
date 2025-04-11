/**
 * Date utility functions for OopsTab
 * Handles locale-aware date formatting
 */

/**
 * Format a timestamp as a relative time string (e.g., "2 hours ago")
 * @param timestamp The timestamp to format
 * @param locale The locale to use, defaults to browser locale
 * @returns Formatted relative time string
 */
export const formatRelativeTime = (
  timestamp: number,
  locale: string = navigator.language
): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  );

  // For very recent times (less than a minute ago)
  if (diffInMinutes < 1) {
    return "Just now";
  }

  // For times less than an hour ago
  if (diffInMinutes < 60) {
    try {
      return new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
        style: "long",
      }).format(-diffInMinutes, "minute");
    } catch (err) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
    }
  }

  // For times less than a day ago
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    try {
      return new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
        style: "long",
      }).format(-diffInHours, "hour");
    } catch (err) {
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    }
  }

  // For times less than a week ago
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    try {
      return new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
        style: "long",
      }).format(-diffInDays, "day");
    } catch (err) {
      return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
    }
  }

  // For older dates, use the locale-aware date format
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
    }).format(date);
  } catch (err) {
    return date.toLocaleDateString();
  }
};

/**
 * Format a timestamp as a full date and time string
 * @param timestamp The timestamp to format
 * @param locale The locale to use, defaults to browser locale
 * @returns Formatted date and time string
 */
export const formatDateTime = (
  timestamp: number,
  locale: string = navigator.language
): string => {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(timestamp));
  } catch (err) {
    return new Date(timestamp).toLocaleString();
  }
};

/**
 * Format a number using locale-aware number formatting
 * @param value The value to format
 * @param locale The locale to use, defaults to browser locale
 * @returns Formatted number string
 */
export const formatNumber = (
  value: number,
  locale: string = navigator.language
): string => {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch (err) {
    return value.toString();
  }
};

/**
 * Format a file size using locale-aware number formatting
 * @param bytes The size in bytes
 * @param locale The locale to use, defaults to browser locale
 * @returns Formatted file size string
 */
export const formatFileSize = (
  bytes: number,
  locale: string = navigator.language
): string => {
  if (bytes < 1024) {
    return `${formatNumber(bytes, locale)} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${formatNumber(bytes / 1024, locale)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${formatNumber(bytes / (1024 * 1024), locale)} MB`;
  }

  return `${formatNumber(bytes / (1024 * 1024 * 1024), locale)} GB`;
};
