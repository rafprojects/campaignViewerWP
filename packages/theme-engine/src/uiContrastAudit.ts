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
 *
 * P76-I: this audit is deliberately scoped to **theme-derived chrome**. It
 * cannot speak for the gallery's own border settings — `card_border_color` is
 * an arbitrary user hex (`sanitize_hex_color`) and `card_border_width` is
 * user-set, so no theme-level check can see them. Read it as "the theme's own
 * affordances clear 3:1", never as a blanket guarantee for a rendered page.
 *
 * P76-I also corrected what this measures. Two families of affordance exist,
 * and only one of them was audited:
 *
 *   - Input borders resolve through `--input-bd` / `--input-bd-focus`, which
 *     the adapter now sets from `borderStrong` / `primaryStroke`. Those are
 *     the six original checks below, and they are now genuinely painted — the
 *     adapter used to pin the border with an inline style, so the focus colour
 *     never reached a pixel.
 *   - Everything else (Button, ActionIcon, Checkbox, Switch, Chip,
 *     SegmentedControl) takes Mantine's global focus ring:
 *       .mantine-focus-auto:focus-visible {
 *         outline: 2px solid var(--mantine-primary-color-filled);
 *         outline-offset: 2px;
 *       }
 *     That is `primaryFill`, not `primaryStroke`, and it was never audited.
 *     Because of the 2px offset the ring sits on the *container* surface, so
 *     it is checked against `surface` / `surfaceRaised` and not `surface2`
 *     (an input's own fill, where no outline ring is ever drawn — Mantine
 *     sets `outline: none` on focused inputs).
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
    // Mantine's global focus ring — see the header note. `primaryFill` is the
    // painted colour here; `primaryStroke` above governs input borders only.
    {
      label: 'primaryFill on surface (Mantine focus ring: buttons, checkbox, switch, chip)',
      fg: rc.primaryFill,
      bg: rc.surface,
      minRatio,
    },
    {
      label: 'primaryFill on surfaceRaised (focus ring inside menus, modals, popovers)',
      fg: rc.primaryFill,
      bg: rc.surfaceRaised,
      minRatio,
    },
    {
      label: 'borderStrong on surface (input outline, checkbox, switch)',
      fg: rc.borderStrong,
      bg: rc.surface,
      minRatio,
    },
    {
      label: 'borderStrong on surface2 (controls on elevated form chrome)',
      fg: rc.borderStrong,
      bg: rc.surface2,
      minRatio,
    },
    {
      label: 'borderStrong on surfaceRaised (inputs inside menus / popovers)',
      fg: rc.borderStrong,
      bg: rc.surfaceRaised,
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
