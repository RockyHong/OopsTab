/**
 * Utils index file
 * Exports all utility functions from the utils directory
 */

export * from "./windowTracking";
export * from "./snapshotManager";
export * from "./restoreManager";
export * from "./testingUtils";
export * from "./browserAPI";

// Add debounce utility

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns The debounced function
 */
export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  wait: number
): ((...args: Parameters<F>) => void) => {
  let timeoutId: number | undefined;

  return function (...args: Parameters<F>): void {
    const later = () => {
      timeoutId = undefined;
      func(...args);
    };

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(later, wait) as unknown as number;
  };
};
