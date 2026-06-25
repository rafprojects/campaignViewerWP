import type { MantineTransition } from '@mantine/core';
import type { GalleryBehaviorSettings } from '@/types';

/**
 * P57-A: Map the `settingsPanelAnimation` setting to Mantine Drawer transitionProps.
 * `none` keeps a transition name but zeroes the duration so the panel opens
 * instantly without a flash. Unknown/legacy values fall back to slide-left.
 */
const SETTINGS_PANEL_TRANSITIONS: Record<
  GalleryBehaviorSettings['settingsPanelAnimation'],
  { transition: MantineTransition; duration: number }
> = {
  'slide-left': { transition: 'slide-left', duration: 200 },
  fade: { transition: 'fade', duration: 200 },
  scale: { transition: 'scale-x', duration: 200 },
  none: { transition: 'fade', duration: 0 },
};

export function resolveSettingsPanelTransition(animation: string | undefined) {
  return (
    SETTINGS_PANEL_TRANSITIONS[animation as GalleryBehaviorSettings['settingsPanelAnimation']]
    ?? SETTINGS_PANEL_TRANSITIONS['slide-left']
  );
}
