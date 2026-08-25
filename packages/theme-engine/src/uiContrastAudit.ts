/**
 * WCAG 1.4.11 non-text contrast audit (P75-E).
 *
 * Mirrors contrastAudit.ts for the classified affordance sites — focus
 * rings, active-tab / drop-target outlines, slider thumb, input focus —
 * which must clear 3:1 against their adjacent surface. Decorative hover
 * borders (admin-btn, media-card hover) are exempt and not listed.
 *
 * Uses resolved `primaryStroke` (nearest rung that already passes, else
 * the authored fill) so a hardcoded `primary[5]` cannot silently return.
 */
import { resolveColors, UI_CONTRAST_MIN } from './colorGen';
import { contrastRatio } from './validation';
import type { ThemeColors } from './types';

export { UI_CONTRAST_MIN };

export interface UiContrastCheck {
  label: string;
  fg: string;
  bg: string;
  minRatio: number;
}

export interface UiContrastFailure extends UiContrastCheck {
  ratio: number;
}

export function intendedUiContrastChecks(
  colors: ThemeColors,
  colorScheme: 'light' | 'dark',
  minRatio: number = UI_CONTRAST_MIN,
): UiContrastCheck[] {
  const rc = resolveColors(colors, colorScheme);
  return [
    {
      label: `primaryStroke on surface (builder outline, tab, gallery focus)`,
      fg: rc.primaryStroke,
      bg: rc.surface,
      minRatio,
    },
    {
      label: `primaryStroke on surface2 (input focus)`,
      fg: rc.primaryStroke,
      bg: rc.surface2,
      minRatio,
    },
    {
      label: `primaryStroke on surfaceRaised (menus / drop targets)`,
      fg: rc.primaryStroke,
      bg: rc.surfaceRaised,
      minRatio,
    },
    {
      label: 'borderStrong on surface (input outline, checkbox, switch)',
      fg: rc.borderStrong,
      bg: rc.surface,
      minRatio,
    },
  ];
}

export function auditUiContrast(
  colors: ThemeColors,
  colorScheme: 'light' | 'dark',
  minRatio: number = UI_CONTRAST_MIN,
): UiContrastFailure[] {
  const failures: UiContrastFailure[] = [];
  for (const check of intendedUiContrastChecks(colors, colorScheme, minRatio)) {
    const ratio = contrastRatio(check.fg, check.bg);
    if (ratio === null) {
      failures.push({ ...check, ratio: 0 });
    } else if (ratio < check.minRatio) {
      failures.push({ ...check, ratio });
    }
  }
  return failures;
}
