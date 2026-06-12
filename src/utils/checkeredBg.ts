import type { CSSProperties } from 'react';

/**
 * Checkered backing so transparent assets read visually at zero detection cost:
 * an opaque image simply covers the pattern, a transparent PNG/SVG shows it.
 * Shared by the builder asset grid and the per-space asset library.
 */
export const CHECKERED_BG: CSSProperties = {
  backgroundColor: 'var(--mantine-color-body)',
  backgroundImage:
    'linear-gradient(45deg, var(--mantine-color-gray-4) 25%, transparent 25%), ' +
    'linear-gradient(-45deg, var(--mantine-color-gray-4) 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, var(--mantine-color-gray-4) 75%), ' +
    'linear-gradient(-45deg, transparent 75%, var(--mantine-color-gray-4) 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
};
