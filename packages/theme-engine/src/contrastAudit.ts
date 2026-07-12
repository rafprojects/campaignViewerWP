/**
 * WCAG AA theme-contrast audit (P62-H).
 *
 * A deterministic, per-theme check that every semantic text/background pair the
 * UI actually renders meets WCAG 2.1 AA contrast (4.5:1 for normal text). The
 * pairs are not encoded in the theme JSON — they live in the Mantine adapter's
 * component overrides (`src/themes/adapter.ts`, where each override co-locates a
 * `backgroundColor` + `color`) and in the LayoutBuilder shell tokens
 * (`useBuilderShellColors` → `--wpsg-builder-*`). This module mirrors those
 * intended pairings so a token change that drops below AA fails a unit test
 * (`contrastAudit.test.ts`) in the blocking CI gate, rather than shipping.
 *
 * Scope: the text-hierarchy pairs (text / textMuted / textMuted2 on the surface
 * layers + body background) and the primary-button label. Focus/keyboard/landmark
 * and Shadow-DOM screen-reader exposure are a separate (human) part of AA — see
 * docs/guides/PRO_FEATURES.md / the P62-H track.
 */
import { resolveColors } from './colorGen';
import { contrastRatio } from './validation';
import type { ThemeColors } from './types';

/** WCAG 2.1 AA minimum contrast for normal-size text. */
export const AA_NORMAL_TEXT = 4.5;

export interface ContrastCheck {
  /** Human-readable pairing, e.g. "textMuted on surface". */
  label: string;
  fg: string;
  bg: string;
  minRatio: number;
}

export interface ContrastFailure extends ContrastCheck {
  ratio: number;
}

/**
 * Enumerate the intended text/background contrast checks for a resolved theme.
 * `minRatio` lets callers tighten the bar (e.g. the high-contrast theme).
 */
export function intendedContrastChecks(
  colors: ThemeColors,
  colorScheme: 'light' | 'dark',
  minRatio: number = AA_NORMAL_TEXT,
): ContrastCheck[] {
  const rc = resolveColors(colors, colorScheme);

  const checks: ContrastCheck[] = [
    // Primary text on every surface layer + the body background (Card/Paper/Modal
    // body, Table td, active SegmentedControl label, etc.).
    { label: 'text on background', fg: rc.text, bg: rc.background, minRatio },
    { label: 'text on surface', fg: rc.text, bg: rc.surface, minRatio },
    { label: 'text on surface2', fg: rc.text, bg: rc.surface2, minRatio },
    { label: 'text on surface3', fg: rc.text, bg: rc.surface3, minRatio },

    // Muted text: field labels, Table th, Modal/Notification close, inactive
    // SegmentedControl label, Notification description (on surface); builder panel
    // headers + dockview tabs (on surface3). Not surface2 — labels sit on the form
    // surface, not inside inputs (input value = text, placeholder = textMuted2).
    { label: 'textMuted on surface', fg: rc.textMuted, bg: rc.surface, minRatio },
    { label: 'textMuted on surface3', fg: rc.textMuted, bg: rc.surface3, minRatio },

    // Lowest-emphasis text: input placeholders (on surface2) + muted-2 body usage
    // (on surface). Placeholder text is subject to AA.
    { label: 'textMuted2 on surface', fg: rc.textMuted2, bg: rc.surface, minRatio },
    { label: 'textMuted2 on surface2', fg: rc.textMuted2, bg: rc.surface2, minRatio },
  ];

  // Primary filled Button label (Mantine autoContrast → black/white) on the
  // primary shade this theme's scheme uses. Passes if the better of black/white
  // reaches AA.
  const shade = rc.primaryShade[colorScheme];
  const buttonBg = rc.primary[shade] ?? rc.primary[colorScheme === 'light' ? 6 : 5]!;
  const useWhite = (contrastRatio('#ffffff', buttonBg) ?? 0) >= (contrastRatio('#000000', buttonBg) ?? 0);
  checks.push({
    label: `primary button label (auto ${useWhite ? 'white' : 'black'}) on primary[${shade}]`,
    fg: useWhite ? '#ffffff' : '#000000',
    bg: buttonBg,
    minRatio,
  });

  return checks;
}

/**
 * Audit a single theme's intended pairs. Returns the failing checks (empty =
 * fully AA-compliant for the pairs we model).
 */
export function auditThemeContrast(
  colors: ThemeColors,
  colorScheme: 'light' | 'dark',
  minRatio: number = AA_NORMAL_TEXT,
): ContrastFailure[] {
  const failures: ContrastFailure[] = [];
  for (const check of intendedContrastChecks(colors, colorScheme, minRatio)) {
    const ratio = contrastRatio(check.fg, check.bg);
    if (ratio === null) {
      failures.push({ ...check, ratio: 0 });
    } else if (ratio < check.minRatio) {
      failures.push({ ...check, ratio });
    }
  }
  return failures;
}
