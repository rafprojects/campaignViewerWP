import { usePersistentAccordion as usePersistentAccordionBase } from '@wp-super-gallery/shared-utils';
import { useRootId } from '@wp-super-gallery/shared-ui';

/**
 * App-side wrapper around the context-free
 * {@link usePersistentAccordionBase | shared-utils `usePersistentAccordion`},
 * injecting the current React root id as the localStorage `scopeId` so the
 * persisted panel is scoped per shortcode mount.
 */
export function usePersistentAccordion(storageKey: string, defaultValue: string | null = null) {
  const scopeId = useRootId();
  return usePersistentAccordionBase(storageKey, defaultValue, { scopeId });
}
