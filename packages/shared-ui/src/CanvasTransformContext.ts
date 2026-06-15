import { createContext, useContext } from 'react';

// ── Canvas transform state shared across the LayoutBuilder canvas tree ──────

export interface CanvasTransformState {
  /** Current CSS zoom scale (1.0 = 100 %). Passed to react-rnd `scale` prop so  */
  /** drag/resize callbacks report coordinates in canvas-space, not screen-space. */
  scale: number;
  /** When true the hand tool is active: panning the canvas is enabled and all  */
  /** slot / overlay drag interactions are disabled.                             */
  isHandTool: boolean;
}

export const CanvasTransformContext = createContext<CanvasTransformState>({
  scale: 1,
  isHandTool: false,
});

/** Convenience hook — consumes CanvasTransformContext. */
export const useCanvasTransform = (): CanvasTransformState =>
  useContext(CanvasTransformContext);
