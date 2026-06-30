import type { CSSProperties } from 'react';
import type { LayoutTextLayer, LayoutTextSemanticTag } from '@/types';
import { typographyOverrideToStyle } from '@/hooks/useTypographyStyle';

/**
 * Style helpers for LayoutBuilder text layers (P59), shared by the builder
 * canvas (P59-B) and the published gallery render (P59-C). Kept in a
 * non-component module so the consuming components stay Fast-Refresh friendly.
 */

/**
 * Maps a text layer's semantic role to the rendered HTML element. `caption`
 * renders as a styled `<p>` — a bare `<figcaption>` is invalid without a
 * `<figure>` ancestor, and these layers are standalone positioned boxes.
 */
const TAG_FOR_ROLE: Record<LayoutTextSemanticTag, 'h2' | 'h3' | 'p'> = {
  heading: 'h2',
  subheading: 'h3',
  paragraph: 'p',
  caption: 'p',
};

export function textLayerElement(role: LayoutTextSemanticTag): 'h2' | 'h3' | 'p' {
  return TAG_FOR_ROLE[role];
}

/**
 * Inner typography style for a text layer — the shared TypographyOverride→CSS
 * plus box alignment. Used by both the builder canvas and the published gallery
 * render so they stay visually identical.
 */
export function textLayerTextStyle(layer: LayoutTextLayer): CSSProperties {
  return {
    ...typographyOverrideToStyle(layer.typography),
    textAlign: layer.textAlign,
    margin: 0,
    width: '100%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };
}

/** Wrapper style that vertically centers the text within the layer box. */
export const TEXT_LAYER_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};
