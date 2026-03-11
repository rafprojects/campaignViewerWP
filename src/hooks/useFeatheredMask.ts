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
  const prevBlobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!maskUrl) {
      if (prevBlobRef.current) {
        URL.revokeObjectURL(prevBlobRef.current);
        prevBlobRef.current = null;
      }
      setResolved(undefined);
      return;
    }
    if (featherPx <= 0) {
      if (prevBlobRef.current) {
        URL.revokeObjectURL(prevBlobRef.current);
        prevBlobRef.current = null;
      }
      setResolved(maskUrl);
      return;
    }

    const seq = ++seqRef.current;
    let cancelled = false;

    featherMask(maskUrl, featherPx)
      .then((url) => {
        if (!cancelled && seqRef.current === seq) {
          if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
          prevBlobRef.current = url.startsWith('blob:') ? url : null;
          setResolved(url);
        } else if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (!cancelled && seqRef.current === seq) {
          setResolved(maskUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [maskUrl, featherPx]);

  // Revoke blob on unmount
  useEffect(() => {
    return () => {
      if (prevBlobRef.current) {
        URL.revokeObjectURL(prevBlobRef.current);
        prevBlobRef.current = null;
      }
    };
  }, []);

  return resolved;
}
