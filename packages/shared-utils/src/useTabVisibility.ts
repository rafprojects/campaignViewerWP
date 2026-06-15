import { useEffect, useState } from 'react';

/**
 * Returns true while the current browser tab is visible
 * (document.visibilityState === 'visible').
 *
 * Used by analytics polling to pause background fetches when the tab is
 * hidden and resume them when the operator returns.
 */
export function useTabVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handler = () => setIsVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return isVisible;
}
