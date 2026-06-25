import type { MantineTransition } from '@mantine/core';
import type { GalleryBehaviorSettings } from '@/types';

/**
 * P57-A: Map the `settingsPanelAnimation` setting to Mantine Drawer transitionProps.
 * `none` keeps a transition name but zeroes the duration so the panel opens
 * instantly without a flash. Unknown/legacy values fall back to slide-left.
 */
// P57-A: "Scale" grows the panel from its bottom-right corner — visually as if
// it expands out of the floating auth menu (anchored at the lower-right) — rather
// than Mantine's built-in `scale-x`, which only scales horizontally from the edge.
const SCALE_FROM_CORNER: MantineTransition = {
  in: { opacity: 1, transform: 'scale(1)' },
  out: { opacity: 0, transform: 'scale(0)' },
  common: { transformOrigin: 'bottom right' },
  transitionProperty: 'transform, opacity',
};

const SETTINGS_PANEL_TRANSITIONS: Record<
  GalleryBehaviorSettings['settingsPanelAnimation'],
  { transition: MantineTransition; duration: number }
> = {
  'slide-left': { transition: 'slide-left', duration: 200 },
  fade: { transition: 'fade', duration: 200 },
  scale: { transition: SCALE_FROM_CORNER, duration: 200 },
  none: { transition: 'fade', duration: 0 },
};

export function resolveSettingsPanelTransition(animation: string | undefined) {
  return (
    SETTINGS_PANEL_TRANSITIONS[animation as GalleryBehaviorSettings['settingsPanelAnimation']]
    ?? SETTINGS_PANEL_TRANSITIONS['slide-left']
  );
}
