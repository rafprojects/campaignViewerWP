import { useScrollRestore as useScrollRestoreBase } from '@mullion/shared-utils';
import { useRootId } from '@mullion/shared-ui';

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
