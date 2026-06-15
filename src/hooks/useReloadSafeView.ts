import { useReloadSafeView as useReloadSafeViewBase } from '@wp-super-gallery/shared-utils';
import { useRootId } from '@wp-super-gallery/shared-ui';

/**
 * App-side wrapper around the context-free
 * {@link useReloadSafeViewBase | shared-utils `useReloadSafeView`}, injecting
 * the current React root id as the localStorage `scopeId` so persisted state is
 * scoped per shortcode mount.
 */
export function useReloadSafeView<T>(feature: string, defaultValue: T): [T, (next: T) => void] {
  const scopeId = useRootId();
  return useReloadSafeViewBase<T>(feature, defaultValue, { scopeId });
}
