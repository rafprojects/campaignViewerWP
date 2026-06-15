import { useScrollRestore as useScrollRestoreBase } from '@wp-super-gallery/shared-utils';
import { useRootId } from '@/contexts/RootIdContext';

/**
 * App-side wrapper around the context-free
 * {@link useScrollRestoreBase | shared-utils `useScrollRestore`}, injecting the
 * current React root id as the localStorage `scopeId` so persisted scroll
 * positions are scoped per shortcode mount.
 */
export function useScrollRestore(feature: string, tabKey?: string | null) {
  const scopeId = useRootId();
  return useScrollRestoreBase(feature, tabKey, { scopeId });
}
