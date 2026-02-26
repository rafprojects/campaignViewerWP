/**
 * P15-J.1: Premade layout template presets.
 *
 * Each preset is a partial LayoutTemplate (no id/createdAt/updatedAt — those
 * are populated when the user creates a template from a preset). All slot
 * positions are percentages of the canvas dimensions.
 *
 * Imported at build time — no runtime fetch needed.
 */
import type { LayoutSlot, LayoutSlotShape } from '@/types';

// ── Helper to create a slot with defaults ────────────────────

let _counter = 0;
function slot(
  overrides: Partial<LayoutSlot> & Pick<LayoutSlot, 'x' | 'y' | 'width' | 'height'>,
): LayoutSlot {
  _counter += 1;
  return {
    id: `preset-${_counter}`,
    zIndex: _counter,
    shape: 'rectangle' as LayoutSlotShape,
    borderRadius: 4,
    borderWidth: 0,
    borderColor: '#ffffff',
    objectFit: 'cover',
    objectPosition: '50% 50%',
    clickAction: 'lightbox',
    hoverEffect: 'pop',
    ...overrides,
  };
}

// ── Preset type ──────────────────────────────────────────────

export interface LayoutPreset {
  /** Display name in the gallery. */
  name: string;
  /** Short description. */
  description: string;
  /** Slot definitions (percentages). */
  slots: LayoutSlot[];
  /** Canvas aspect ratio. */
  canvasAspectRatio: number;
  /** Tags for filtering. */
  tags: string[];
}

// ── Presets ──────────────────────────────────────────────────

function resetCounter() { _counter = 0; }

function makeHeroThumbnails(): LayoutPreset {
  resetCounter();
  return {
    name: 'Hero + Thumbnails',
    description: '1 large hero image (60%) with 4 small thumbnails in a 2×2 grid',
    canvasAspectRatio: 16 / 9,
    tags: ['hero', 'grid', 'portfolio'],
    slots: [
      slot({ x: 0, y: 0, width: 58, height: 100 }),
      slot({ x: 60, y: 0, width: 40, height: 48 }),
      slot({ x: 60, y: 52, width: 40, height: 48 }),
      // Split the right side into 2×2
      slot({ x: 60, y: 0, width: 19, height: 48 }),
      slot({ x: 81, y: 0, width: 19, height: 48 }),
    ].slice(0, 5),
  };
}

function makeMagazineSpread(): LayoutPreset {
  resetCounter();
  return {
    name: 'Magazine Spread',
    description: 'Asymmetric 3-column layout with varying heights',
    canvasAspectRatio: 16 / 9,
    tags: ['magazine', 'editorial', 'asymmetric'],
    slots: [
      slot({ x: 0, y: 0, width: 32, height: 65 }),
      slot({ x: 0, y: 68, width: 32, height: 32 }),
      slot({ x: 34, y: 0, width: 32, height: 45 }),
      slot({ x: 34, y: 48, width: 32, height: 52 }),
      slot({ x: 68, y: 0, width: 32, height: 100 }),
    ],
  };
}

function makePinterestBoard(): LayoutPreset {
  resetCounter();
  return {
    name: 'Pinterest Board',
    description: '3-column masonry-like layout with staggered heights',
    canvasAspectRatio: 4 / 3,
    tags: ['pinterest', 'masonry', 'grid'],
    slots: [
      slot({ x: 0, y: 0, width: 31, height: 55 }),
      slot({ x: 0, y: 58, width: 31, height: 42 }),
      slot({ x: 34, y: 0, width: 31, height: 40 }),
      slot({ x: 34, y: 43, width: 31, height: 57 }),
      slot({ x: 68, y: 0, width: 32, height: 48 }),
      slot({ x: 68, y: 51, width: 32, height: 49 }),
    ],
  };
}

function makeFilmStrip(): LayoutPreset {
  resetCounter();
  return {
    name: 'Film Strip',
    description: 'Single row of equal-width images at cinematic ratio',
    canvasAspectRatio: 21 / 9,
    tags: ['film', 'cinematic', 'horizontal'],
    slots: [
      slot({ x: 0, y: 5, width: 19, height: 90 }),
      slot({ x: 20, y: 5, width: 19, height: 90 }),
      slot({ x: 40, y: 5, width: 19, height: 90 }),
      slot({ x: 60, y: 5, width: 19, height: 90 }),
      slot({ x: 80, y: 5, width: 19, height: 90 }),
    ],
  };
}

function makeSpotlight(): LayoutPreset {
  resetCounter();
  return {
    name: 'Spotlight',
    description: '1 centered large image flanked by 2 smaller images',
    canvasAspectRatio: 16 / 9,
    tags: ['spotlight', 'featured', 'hero'],
    slots: [
      slot({ x: 2, y: 15, width: 22, height: 70 }),
      slot({ x: 27, y: 5, width: 46, height: 90 }),
      slot({ x: 76, y: 15, width: 22, height: 70 }),
    ],
  };
}

function makeGrid2x2(): LayoutPreset {
  resetCounter();
  return {
    name: 'Grid 2×2',
    description: 'Equal quadrants — simple 4-image grid',
    canvasAspectRatio: 1,
    tags: ['grid', 'square', 'simple'],
    slots: [
      slot({ x: 0, y: 0, width: 49, height: 49 }),
      slot({ x: 51, y: 0, width: 49, height: 49 }),
      slot({ x: 0, y: 51, width: 49, height: 49 }),
      slot({ x: 51, y: 51, width: 49, height: 49 }),
    ],
  };
}

function makeGrid3x3(): LayoutPreset {
  resetCounter();
  return {
    name: 'Grid 3×3',
    description: 'Equal 9-cell grid — classic mosaic',
    canvasAspectRatio: 1,
    tags: ['grid', 'mosaic', 'square'],
    slots: Array.from({ length: 9 }, (_, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      return slot({ x: col * 34, y: row * 34, width: 32, height: 32 });
    }),
  };
}

function makePanoramic(): LayoutPreset {
  resetCounter();
  return {
    name: 'Panoramic',
    description: 'Full-width hero with 3 columns below',
    canvasAspectRatio: 4 / 3,
    tags: ['panoramic', 'hero', 'columns'],
    slots: [
      slot({ x: 0, y: 0, width: 100, height: 55 }),
      slot({ x: 0, y: 58, width: 32, height: 42 }),
      slot({ x: 34, y: 58, width: 32, height: 42 }),
      slot({ x: 68, y: 58, width: 32, height: 42 }),
    ],
  };
}

function makeDiagonalCascade(): LayoutPreset {
  resetCounter();
  return {
    name: 'Diagonal Cascade',
    description: 'Overlapping images along a diagonal line',
    canvasAspectRatio: 16 / 9,
    tags: ['diagonal', 'cascade', 'creative', 'overlap'],
    slots: [
      slot({ x: 0, y: 0, width: 35, height: 45, zIndex: 1 }),
      slot({ x: 15, y: 15, width: 35, height: 45, zIndex: 2 }),
      slot({ x: 30, y: 30, width: 35, height: 45, zIndex: 3 }),
      slot({ x: 45, y: 45, width: 35, height: 45, zIndex: 4 }),
    ],
  };
}

function makePhotoStack(): LayoutPreset {
  resetCounter();
  return {
    name: 'Photo Stack',
    description: 'Overlapping images at slight offsets — stacked look',
    canvasAspectRatio: 1,
    tags: ['stack', 'overlap', 'creative'],
    slots: [
      slot({ x: 5, y: 10, width: 55, height: 70, zIndex: 1 }),
      slot({ x: 20, y: 5, width: 55, height: 70, zIndex: 2 }),
      slot({ x: 35, y: 15, width: 55, height: 70, zIndex: 3 }),
    ],
  };
}

function makeLShape(): LayoutPreset {
  resetCounter();
  return {
    name: 'L-Shape',
    description: 'One tall image beside 2–3 shorter images',
    canvasAspectRatio: 16 / 9,
    tags: ['l-shape', 'asymmetric', 'portfolio'],
    slots: [
      slot({ x: 0, y: 0, width: 40, height: 100 }),
      slot({ x: 42, y: 0, width: 58, height: 32 }),
      slot({ x: 42, y: 34, width: 58, height: 32 }),
      slot({ x: 42, y: 68, width: 58, height: 32 }),
    ],
  };
}

function makeTLayout(): LayoutPreset {
  resetCounter();
  return {
    name: 'T-Layout',
    description: 'Wide image on top with 3 columns below',
    canvasAspectRatio: 16 / 9,
    tags: ['t-layout', 'columns', 'header'],
    slots: [
      slot({ x: 0, y: 0, width: 100, height: 48 }),
      slot({ x: 0, y: 52, width: 32, height: 48 }),
      slot({ x: 34, y: 52, width: 32, height: 48 }),
      slot({ x: 68, y: 52, width: 32, height: 48 }),
    ],
  };
}

// ── Export all presets ────────────────────────────────────────

export const LAYOUT_PRESETS: LayoutPreset[] = [
  makeHeroThumbnails(),
  makeMagazineSpread(),
  makePinterestBoard(),
  makeFilmStrip(),
  makeSpotlight(),
  makeGrid2x2(),
  makeGrid3x3(),
  makePanoramic(),
  makeDiagonalCascade(),
  makePhotoStack(),
  makeLShape(),
  makeTLayout(),
];
