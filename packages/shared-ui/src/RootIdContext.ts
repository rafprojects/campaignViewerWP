import { createContext, useContext } from 'react';

/**
 * P36-A: Identifies the React root instance on this page. Used to scope
 * localStorage keys so multiple shortcode mounts on the same page don't
 * collide (key convention: `wpsg_view_<rootId>_<feature>`).
 *
 * Defaults to 'root' so components that render outside a provider (e.g. tests,
 * Storybook) still work without throwing.
 */
const RootIdContext = createContext<string>('root');

export const RootIdProvider = RootIdContext.Provider;

export function useRootId(): string {
  return useContext(RootIdContext);
}
