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
 * P76-I-2: this gate briefly carried a KNOWN_FOCUS_RING_GAPS exception table.
 * It recorded 13 of 23 bundled themes whose focus ring fell under 3:1, because
 * Mantine draws that ring from `primaryFill` while the audit only measured
 * `primaryStroke`. The ring has since been re-pointed at `primaryStroke`
 * (P76-I-2 Option A, implemented in `src/styles/global.scss`), so every
 * affordance now resolves to a token this audit already checks and the table
 * is gone. The gate is strict again: **no exceptions.**
 */
describe('theme UI contrast — WCAG 1.4.11 (P75-E)', () => {
  for (const def of bundledThemeDefinitions) {
    it(`${def.id}: affordance strokes and borderStrong meet ${UI_CONTRAST_MIN}:1`, () => {
      const colors = def.colors as ThemeColors;
      const failures = auditUiContrast(colors, def.colorScheme);
      const report = failures
        .map((f) => `  - ${f.label}: ${f.fg} on ${f.bg} = ${f.ratio.toFixed(2)}:1 (need ${f.minRatio}:1)`)
        .join('\n');
      expect(
        failures,
        `${def.id} has ${failures.length} UI-contrast failure(s):\n${report}`,
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
