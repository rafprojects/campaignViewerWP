import type { LayoutTextLayer } from '@/types';
import { textLayerElement, textLayerTextStyle, TEXT_LAYER_WRAPPER_STYLE } from '@/utils/textLayerStyle';

/**
 * Renders a text layer's visual content: the semantic element (h2/h3/p) carrying
 * the layer's typography, vertically centered in its box. Used by the builder
 * canvas (P59-B); the published gallery (P59-C) reuses the same style helpers
 * (`@/utils/textLayerStyle`) and adds positioning + a11y context.
 */
export function TextLayerContent({ layer }: { layer: LayoutTextLayer }) {
  const Tag = textLayerElement(layer.semanticTag);
  return (
    <div style={TEXT_LAYER_WRAPPER_STYLE}>
      <Tag data-wpsg-text-role={layer.semanticTag} style={textLayerTextStyle(layer)}>
        {layer.content}
      </Tag>
    </div>
  );
}
