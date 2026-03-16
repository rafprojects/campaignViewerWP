/**
 * Safe localStorage wrapper that handles restrictive browser settings
 * (private browsing, disabled storage, storage quota exceeded, etc.)
 * without throwing.
 */
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or disabled — silently degrade
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage disabled — silently degrade
    }
  },
};
