/**
 * P37-LB1: Builder overlay color map derived from the active theme's
 * color scheme. Returns concrete color strings (not CSS variables) so
 * they can be used directly in SVG fill/stroke attributes.
 *
 * Dark values preserve the original hardcoded constants; light values
 * provide adapted equivalents with appropriate contrast.
 */
import { useTheme } from './useTheme';

export interface BuilderOverlayColors {
  // Ruler strip
  rulerBg: string;
  rulerTick: string;
  rulerLabel: string;
  rulerSelection: string;
  // Grid lines
  gridMajor: string;
  gridMinor: string;
  // Smart guide lines
  guideEdge: string;
  guideCenter: string;
  guideSpacing: string;
  // Measurement overlay
  measureLine: string;
  measureLabelBg: string;
  measureLabelFg: string;
  // Slot chrome (badges / live-info tooltip)
  slotBadgeBg: string;
  slotLockBg: string;
  slotLiveInfoBg: string;
}

const DARK: BuilderOverlayColors = {
  rulerBg: 'rgba(30,30,30,0.85)',
  rulerTick: 'rgba(200,200,200,0.7)',
  rulerLabel: 'rgba(200,200,200,0.85)',
  rulerSelection: 'rgba(70,150,255,0.35)',
  gridMajor: 'rgba(128,128,128,0.25)',
  gridMinor: 'rgba(128,128,128,0.12)',
  guideEdge: '#ff6b6b',
  guideCenter: '#4dabf7',
  guideSpacing: '#69db7c',
  measureLine: 'rgba(70,180,255,0.7)',
  measureLabelBg: 'rgba(0,0,30,0.82)',
  measureLabelFg: 'rgba(200,230,255,1)',
  slotBadgeBg: 'rgba(0,0,0,0.6)',
  slotLockBg: 'rgba(0,0,0,0.65)',
  slotLiveInfoBg: 'rgba(0,0,0,0.82)',
};

const LIGHT: BuilderOverlayColors = {
  rulerBg: 'rgba(215,215,215,0.92)',
  rulerTick: 'rgba(80,80,80,0.7)',
  rulerLabel: 'rgba(60,60,60,0.9)',
  rulerSelection: 'rgba(37,99,235,0.3)',
  gridMajor: 'rgba(100,100,100,0.22)',
  gridMinor: 'rgba(100,100,100,0.1)',
  guideEdge: '#e03131',
  guideCenter: '#1971c2',
  guideSpacing: '#2f9e44',
  measureLine: 'rgba(25,113,194,0.8)',
  measureLabelBg: 'rgba(240,246,255,0.95)',
  measureLabelFg: 'rgba(15,40,100,1)',
  slotBadgeBg: 'rgba(30,30,30,0.7)',
  slotLockBg: 'rgba(30,30,30,0.72)',
  slotLiveInfoBg: 'rgba(20,20,20,0.88)',
};

export function useBuilderOverlayColors(): BuilderOverlayColors {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? DARK : LIGHT;
}
