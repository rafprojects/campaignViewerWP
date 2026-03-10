/**
 * useFeatheredMask — React hook that applies canvas-based feathering to a mask.
 *
 * Returns the original `maskUrl` when feather is 0, or a feathered blob URL
 * when feather > 0.  The feathering is performed asynchronously; the hook
 * returns the last resolved URL (or the original) while processing.
 */
import { useState, useEffect, useRef } from 'react';
import { featherMask } from '@/utils/maskFeather';

export function useFeatheredMask(
  maskUrl: string | undefined,
  featherPx: number,
): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(maskUrl);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!maskUrl) {
      setResolved(undefined);
      return;
    }
    if (featherPx <= 0) {
      setResolved(maskUrl);
      return;
    }

    const seq = ++seqRef.current;
    let cancelled = false;

    featherMask(maskUrl, featherPx)
      .then((url) => {
        if (!cancelled && seqRef.current === seq) {
          setResolved(url);
        }
      })
      .catch(() => {
        // On error, fall back to unfeathered mask
        if (!cancelled && seqRef.current === seq) {
          setResolved(maskUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [maskUrl, featherPx]);

  return resolved;
}
