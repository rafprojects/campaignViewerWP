import { useEffect } from 'react';
import type { LayoutTextLayer } from '@/types';
import { loadGoogleFont } from '@wp-super-gallery/shared-utils';
import { GOOGLE_FONT_NAMES } from '@/components/Common/TypographyEditor';
import { textLayerElement, textLayerTextStyle, TEXT_LAYER_WRAPPER_STYLE } from '@/utils/textLayerStyle';

/**
 * Renders a text layer's visual content: the semantic element (h2/h3/p) carrying
 * the layer's typography, vertically centered in its box. Used by the builder
 * canvas (P59-B); the published gallery (P59-C) reuses the same style helpers
 * (`@/utils/textLayerStyle`) and adds positioning + a11y context.
 */
export function TextLayerContent({ layer }: { layer: LayoutTextLayer }) {
  const fontFamily = layer.typography.fontFamily;
  // Re-inject the layer's Google Font wherever the text renders (builder canvas
  // + published gallery). loadGoogleFont() is idempotent. Without this, a saved
  // non-system font reverts to its fallback on reload, because the @font-face is
  // only injected when the font is first selected in the editor.
  useEffect(() => {
    if (!fontFamily) return;
    const name = fontFamily.split(',')[0]!.trim();
    if (GOOGLE_FONT_NAMES.has(name)) loadGoogleFont(name);
  }, [fontFamily]);

  const Tag = textLayerElement(layer.semanticTag);
  return (
    <div style={TEXT_LAYER_WRAPPER_STYLE}>
      <Tag data-wpsg-text-role={layer.semanticTag} style={textLayerTextStyle(layer)}>
        {layer.content}
      </Tag>
    </div>
  );
}
