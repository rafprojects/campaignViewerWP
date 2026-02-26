/**
 * WPSG Debug utilities.
 *
 * All debug logging is gated behind the `wpsg_debug` localStorage flag.
 * Toggle via Admin → Settings → Advanced → "Enable debug logging",
 * or manually: `localStorage.setItem('wpsg_debug', '1')` in console.
 */

const STORAGE_KEY = 'wpsg_debug';

/** Check whether WPSG debug mode is enabled. */
export function isDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // SSR / sandboxed iframe
  }
}

/** Log a debug group (collapsed) — only visible when debug mode is on. */
export function debugGroup(label: string): void {
  if (isDebugEnabled()) console.groupCollapsed(label);
}

/** Log a debug message — only visible when debug mode is on. */
export function debugLog(...args: unknown[]): void {
  if (isDebugEnabled()) console.log(...args);
}

/** End the current debug group — only visible when debug mode is on. */
export function debugGroupEnd(): void {
  if (isDebugEnabled()) console.groupEnd();
}
