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
 *     SegmentedControl) takes Mantine's global focus ring, which Mantine
 *     draws from `--mantine-primary-color-filled`:
 *       .mantine-focus-auto:focus-visible {
 *         outline: 2px solid var(--mantine-primary-color-filled);
 *         outline-offset: 2px;
 *       }
 *     That is `primaryFill`, and measured across the bundled themes it fell
 *     below 3:1 on 13 of 23. **P76-I-2 re-pointed that ring at
 *     `primaryStroke`** (the focus-ring block, which P77-A moved to `src/styles/chrome-portable.scss`),
 *     so both families of affordance now resolve to the same audited token and
 *     the checks below cover the ring as painted. Because of the ring's 2px
 *     offset it sits on the *container* surface, which is why `surface` and
 *     `surfaceRaised` are the grounds that matter for it; `surface2` is an
 *     input's own fill, where no outline ring is ever drawn.
 */
import { resolveColors, UI_CONTRAST_MIN } from './colorGen';
import { contrastRatio } from './validation';
import { deriveComponentTokens, type ComponentTokenKey } from './componentTokens';
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
  componentTokenOverrides: Partial<Record<ComponentTokenKey, string>> = {},
): UiContrastCheck[] {
  const rc = resolveColors(colors, colorScheme);
  // P78-C: the affordance strokes and the grounds they sit on are component
  // tokens now, so the audit names what the framework will actually paint
  // instead of inferring it from the Mantine variable the adapter happened to
  // write. Every value below resolves to the same colour the role-token form
  // checked before, which is why the gate stayed at zero exceptions through
  // the change; what moved is that a changed derivation now fails the audit
  // rather than silently changing a pixel.
  const ct = deriveComponentTokens(rc, componentTokenOverrides);
  // P77-F: the focus ring is a pair, core (`primaryStroke`) plus a neutral
  // halo. The guarantee is that the pair contrasts with itself and that one
  // of the two tones contrasts with each ground the ring sits on. The single
  // core-on-ground checks below stay for the affordances that have no halo
  // (input focus borders, active tabs, builder outlines).
  const better = (ground: string): { fg: string; tone: string } =>
    (contrastRatio(rc.focusHalo, ground) ?? 0) >= (contrastRatio(rc.primaryStroke, ground) ?? 0)
      ? { fg: rc.focusHalo, tone: 'halo' }
      : { fg: rc.primaryStroke, tone: 'core' };
  const pairOn = (name: string, ground: string): UiContrastCheck => {
    const { fg, tone } = better(ground);
    return { label: `focus ring pair on ${name} (${tone} carries it)`, fg, bg: ground, minRatio };
  };
  return [
    {
      label: 'focus halo against ring core (the pair contrasts with itself)',
      fg: rc.focusHalo,
      bg: rc.primaryStroke,
      minRatio,
    },
    pairOn('surface', rc.surface),
    pairOn('surfaceRaised', rc.surfaceRaised),
    {
      label: 'tab-indicator-color on surface (active tab, builder outline)',
      fg: ct['tab-indicator-color'],
      bg: rc.surface,
      minRatio,
    },
    {
      label: 'input-bd-focus on input-bg (input focus border)',
      fg: ct['input-bd-focus'],
      bg: ct['input-bg'],
      minRatio,
    },
    {
      label: 'input-bd on input-bg (input resting outline)',
      fg: ct['input-bd'],
      bg: ct['input-bg'],
      minRatio,
    },
    {
      label: 'checkbox-bd on surface (unchecked checkbox border)',
      fg: ct['checkbox-bd'],
      bg: rc.surface,
      minRatio,
    },
    {
      label: 'switch-track-bd on switch-track-bg (switch track outline)',
      fg: ct['switch-track-bd'],
      bg: ct['switch-track-bg'],
      minRatio,
    },
    {
      label: 'primaryStroke on menu-bg (drop targets inside dropdowns)',
      fg: rc.primaryStroke,
      bg: ct['menu-bg'],
      minRatio,
    },
    {
      label: 'input-bd on menu-bg (inputs inside menus / popovers)',
      fg: ct['input-bd'],
      bg: ct['menu-bg'],
      minRatio,
    },
  ];
}

export function auditUiContrast(
  colors: ThemeColors,
  colorScheme: 'light' | 'dark',
  minRatio: number = UI_CONTRAST_MIN,
  componentTokenOverrides: Partial<Record<ComponentTokenKey, string>> = {},
): UiContrastFailure[] {
  const failures: UiContrastFailure[] = [];
  for (const check of intendedUiContrastChecks(
    colors,
    colorScheme,
    minRatio,
    componentTokenOverrides,
  )) {
    const ratio = contrastRatio(check.fg, check.bg);
    if (ratio === null) {
      failures.push({ ...check, ratio: 0 });
    } else if (ratio < check.minRatio) {
      failures.push({ ...check, ratio });
    }
  }
  return failures;
}
