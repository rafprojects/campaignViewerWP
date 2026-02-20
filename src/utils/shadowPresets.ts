import type { ShadowPreset } from '@/types';

const SHADOW_PRESETS: Record<Exclude<ShadowPreset, 'custom'>, string> = {
  none: 'none',
  subtle: '0 2px 8px rgba(0,0,0,0.15)',
  medium: '0 4px 16px rgba(0,0,0,0.25)',
  strong: '0 8px 30px rgba(0,0,0,0.35)',
};

/**
 * Resolve a shadow preset (or custom string) into a CSS box-shadow value.
 */
export function resolveBoxShadow(preset: ShadowPreset, custom: string): string {
  if (preset === 'custom') return custom || 'none';
  return SHADOW_PRESETS[preset] ?? 'none';
}
