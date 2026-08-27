/**
 * P75-E: WCAG 1.4.11 gate for every bundled theme.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { bundledThemeDefinitions } from './bundledThemes';
import { auditUiContrast, UI_CONTRAST_MIN } from './uiContrastAudit';
import { resolveColors } from './colorGen';
import type { ThemeColors } from './types';

/**
 * P76-I: Mantine's global focus ring is `primaryFill`, not `primaryStroke` —
 *
 *   .mantine-focus-auto:focus-visible {
 *     outline: 2px solid var(--mantine-primary-color-filled);
 *     outline-offset: 2px;
 *   }
 *
 * — and it was never audited. Adding it to `intendedUiContrastChecks` surfaces
 * a pre-existing gap on 13 of 23 bundled themes, every one of them dark. This
 * is a **finding, not a regression**: nothing changed about what those themes
 * paint, only about what the gate can see.
 *
 * The gap is itemised here rather than suppressed, so that:
 *   - every failing theme, check, and ratio is written down in the repo;
 *   - a NEW failure, or an EXISTING one getting worse, still fails the gate;
 *   - closing the gap is a matter of deleting entries from this table.
 *
 * The six input-border checks (`primaryStroke`, `borderStrong`) remain strict
 * with zero exceptions — they pass on all 23 themes.
 *
 * Ratios recorded 2026-08-27. Pending the P76-I-2 decision: re-point the ring
 * at `primaryStroke` (which already clears 3:1 everywhere), lift `primaryFill`
 * on these themes, or accept the gap on record.
 */
const KNOWN_FOCUS_RING_GAPS: Record<string, Record<string, number>> = {
  'darcula': { surface: 1.08, surfaceRaised: 1.08 },
  'gruvbox-dark': { surface: 1.49, surfaceRaised: 1.14 },
  'catppuccin-mocha': { surface: 1.68, surfaceRaised: 1.22 },
  'nord': { surface: 1.85, surfaceRaised: 1.58 },
  'tokyo-night': { surface: 1.92, surfaceRaised: 1.17 },
  'solarized-dark': { surface: 2.35, surfaceRaised: 2.04 },
  'synthwave': { surface: 2.73, surfaceRaised: 2.24 },
  'material-dark': { surface: 2.74, surfaceRaised: 2.30 },
  'halloween': { surface: 2.88, surfaceRaised: 2.38 },
  'default-dark': { surface: 2.95, surfaceRaised: 2.40 },
  'cyberpunk': { surface: 2.97, surfaceRaised: 2.62 },
  'high-contrast': { surfaceRaised: 2.49 },
  'crimson-canvas': { surfaceRaised: 2.52 },
};

/** Which ground a failure label refers to, for lookup in the table above. */
function groundOf(label: string): string | null {
  if (!label.startsWith('primaryFill on ')) return null;
  return label.slice('primaryFill on '.length).split(' ')[0] ?? null;
}

describe('theme UI contrast — WCAG 1.4.11 (P75-E)', () => {
  for (const def of bundledThemeDefinitions) {
    it(`${def.id}: affordance strokes and borderStrong meet ${UI_CONTRAST_MIN}:1`, () => {
      const colors = def.colors as ThemeColors;
      const failures = auditUiContrast(colors, def.colorScheme);
      const allowed = KNOWN_FOCUS_RING_GAPS[def.id] ?? {};

      const unexpected = failures.filter((f) => {
        const ground = groundOf(f.label);
        if (ground === null) return true; // input-border checks: no exceptions
        const recorded = allowed[ground];
        if (recorded === undefined) return true; // a newly-failing ground
        // Known gap — but it must not have got worse since it was recorded.
        return f.ratio < recorded - 0.005;
      });

      const report = unexpected
        .map((f) => `  - ${f.label}: ${f.fg} on ${f.bg} = ${f.ratio.toFixed(2)}:1 (need ${f.minRatio}:1)`)
        .join('\n');
      expect(
        unexpected,
        `${def.id} has ${unexpected.length} unexpected UI-contrast failure(s):\n${report}`,
      ).toHaveLength(0);
    });

    it(`${def.id}: primaryFill is the authored shade, not a hardcoded 5`, () => {
      const colors = def.colors as ThemeColors;
      const rc = resolveColors(colors, def.colorScheme);
      const authored = rc.primaryShade[def.colorScheme];
      expect(rc.primaryFillIndex).toBe(authored);
      expect(rc.primaryFill).toBe(rc.primary[authored]);
    });

    it(`${def.id}: stroke equals fill when fill already meets 3:1 on audited surfaces`, () => {
      const colors = def.colors as ThemeColors;
      const rc = resolveColors(colors, def.colorScheme);
      const fillOk = [rc.surface, rc.surface2, rc.surfaceRaised].every(
        (s) => chroma.contrast(rc.primaryFill, s) >= UI_CONTRAST_MIN,
      );
      if (fillOk) {
        expect(rc.primaryStroke).toBe(rc.primaryFill);
      }
    });
  }
});

/**
 * The exception table must not outlive the gap it documents: a theme listed
 * here that no longer fails would otherwise sit in the repo forever, implying
 * a problem that has been fixed. This fails when an entry becomes stale.
 */
describe('P76-I focus-ring exception table is current', () => {
  for (const [themeId, grounds] of Object.entries(KNOWN_FOCUS_RING_GAPS)) {
    it(`${themeId}: every recorded gap still fails`, () => {
      const def = bundledThemeDefinitions.find((d) => d.id === themeId);
      expect(def, `${themeId} is listed but is not a bundled theme`).toBeDefined();
      const failures = auditUiContrast(def!.colors as ThemeColors, def!.colorScheme);
      const failingGrounds = new Set(
        failures.map((f) => groundOf(f.label)).filter((g): g is string => g !== null),
      );
      for (const ground of Object.keys(grounds)) {
        expect(
          failingGrounds.has(ground),
          `${themeId}/${ground} no longer fails — remove it from KNOWN_FOCUS_RING_GAPS`,
        ).toBe(true);
      }
    });
  }
});
