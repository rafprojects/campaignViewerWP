import { Title, Group } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';
import type { ResolvedGalleryHeading, SharedGalleryCommonSettings } from './runtimeCommon';

interface AdapterHeadingProps {
  common: SharedGalleryCommonSettings;
  heading: ResolvedGalleryHeading;
  /**
   * Optional, already-sized label icon (e.g. `<IconDiamond size={18} />`).
   *
   * When provided, the label is wrapped in a `<Group>` and the icon is shown
   * subject to `common.showGalleryLabelIcon` — matching the icon-bearing
   * adapters. When omitted, the bare label is rendered — matching the
   * icon-less adapters (Pinterest/Stacked/Coverflow/Spotlight/ScrollSnap).
   */
  icon?: ReactNode;
  /** Extra `<Title>` style (Masonry passes its typography style here). */
  titleStyle?: CSSProperties;
}

/**
 * Shared adapter heading (Phase 70-A): the `heading.visible && <Title>…` block
 * that gallery adapters previously hand-copied. Renders nothing when the
 * heading is hidden. The `<Title order={3} size="h5">` shell, justification and
 * optional `<Group>`/icon layout reproduce the prior per-adapter JSX exactly.
 */
export function AdapterHeading({ common, heading, icon, titleStyle }: AdapterHeadingProps) {
  if (!heading.visible) return null;

  const justify = common.galleryLabelJustification || 'left';

  return (
    <Title order={3} size="h5" ta={justify} style={titleStyle}>
      {icon !== undefined ? (
        <Group gap={8} component="span" justify={justify}>
          {common.showGalleryLabelIcon && icon}
          {heading.label}
        </Group>
      ) : (
        heading.label
      )}
    </Title>
  );
}
