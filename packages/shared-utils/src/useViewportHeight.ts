import { useState, useEffect } from 'react';

/**
 * Returns `window.innerHeight` (reactive on resize).
 * Falls back to 800 during SSR / tests.
 */
export function useViewportHeight(): number {
  const [vh, setVh] = useState(
    () => (typeof window !== 'undefined' ? window.innerHeight : 800),
  );

  useEffect(() => {
    const handler = () => setVh(window.innerHeight);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return vh;
}
