/**
 * P62-H: WCAG AA contrast gate for every bundled theme.
 *
 * Fails (blocking, in the fast Vitest CI job) if any theme's intended
 * text/background pair drops below AA. See contrastAudit.ts for the pair set.
 */
import { describe, it, expect } from 'vitest';
import { bundledThemeDefinitions } from './bundledThemes';
import { auditThemeContrast, AA_NORMAL_TEXT } from './contrastAudit';
import type { ThemeColors } from './types';

describe('theme contrast — WCAG AA (P62-H)', () => {
  for (const def of bundledThemeDefinitions) {
    it(`${def.id}: intended text pairs meet AA (${AA_NORMAL_TEXT}:1)`, () => {
      // _base.json carries no colors, so each theme's block is complete at runtime.
      const failures = auditThemeContrast(def.colors as ThemeColors, def.colorScheme);
      const report = failures
        .map((f) => `  - ${f.label}: ${f.fg} on ${f.bg} = ${f.ratio.toFixed(2)}:1 (need ${f.minRatio}:1)`)
        .join('\n');
      expect(
        failures,
        `${def.id} has ${failures.length} contrast failure(s):\n${report}`,
      ).toHaveLength(0);
    });
  }
});
