import { useCallback, useRef } from 'react';
import type { DockviewReadyEvent, DockviewApi } from 'dockview';
import type { LayoutScope } from './useBuilderWorkspacePrefs';

export function useBuilderDockLayout({
  rootId,
  layoutScope,
  initialTemplateId,
}: {
  rootId: string;
  layoutScope: LayoutScope;
  initialTemplateId: string;
}) {
  const dockApiRef = useRef<DockviewApi | null>(null);

  const handleDockReady = useCallback((event: DockviewReadyEvent) => {
    dockApiRef.current = event.api;
    const templateId = initialTemplateId;
    const LAYOUT_KEY = layoutScope === 'per-template' && templateId
      ? `wpsg_builder_${rootId}_template_${templateId}_layout`
      : `wpsg_builder_${rootId}_layout`;
    // P30-E: bumped 1 → 2 (removed History dock tab).
    // P50-H: bumped 2 → 3 (canvas panel carries tabComponent:'canvas' for hideClose;
    // old saves without that field must be cleared so the close button disappears).
    const LAYOUT_VERSION = 3;
    const persistLayout = () => {
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: LAYOUT_VERSION, layout: event.api.toJSON() }));
      } catch { /* ignore storage errors */ }
    };
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { version?: number; layout?: unknown } | null;
        const savedVersion = parsed && typeof parsed === 'object' ? (parsed.version ?? 0) : 0;
        if (savedVersion < LAYOUT_VERSION) {
          // Old layout (pre-P30-E) — clear and fall through to the new default.
          try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
        } else {
          // Accept both versioned { version, layout } and legacy bare-JSON saves.
          const layout =
            parsed && typeof parsed === 'object' && 'layout' in parsed
              ? parsed.layout
              : parsed;
          event.api.fromJSON(layout as Parameters<typeof event.api.fromJSON>[0]);
          event.api.onDidLayoutChange(persistLayout);
          return;
        }
      } catch {
        // Saved layout is invalid or incompatible — clear it so every
        // subsequent open doesn't repeat the same try/catch failure.
        try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
        // fall through to default layout
      }
    }
    // Default layout: Layers+Media tabs left | Canvas centre | Properties right
    const layersPanel = event.api.addPanel({ id: 'layers', component: 'layers', title: 'Layers' });
    event.api.addPanel({ id: 'media', component: 'media', title: 'Media & Assets', position: { direction: 'within', referencePanel: layersPanel } });
    const canvasPanel = event.api.addPanel({ id: 'canvas', component: 'canvas', tabComponent: 'canvas', title: 'Canvas', position: { direction: 'right', referencePanel: layersPanel } });
    event.api.addPanel({ id: 'properties', component: 'properties', title: 'Properties', position: { direction: 'right', referencePanel: canvasPanel } });
    event.api.onDidLayoutChange(persistLayout);
  }, [rootId, layoutScope, initialTemplateId]);

  return { dockApiRef, handleDockReady };
}
