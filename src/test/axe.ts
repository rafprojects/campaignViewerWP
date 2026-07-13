/**
 * P62-H: component-level accessibility assertion (structural WCAG A/AA in jsdom).
 *
 * Runs axe-core over a rendered container and throws a readable error on any
 * violation. Scope: the structural WCAG 2.1 A/AA rules that work in jsdom — roles,
 * accessible names, form labels, ARIA validity/required-attrs, image alt, etc.
 *
 * Deliberately NOT checked here:
 *  - `color-contrast` — jsdom has no layout engine, so real contrast can't be
 *    computed. Contrast is gated separately by the deterministic theme-contrast
 *    audit (packages/theme-engine/contrastAudit) + the e2e axe suite.
 *  - landmark/`region` best-practice rules — components render in isolation (not a
 *    full page), so these would false-positive. Only WCAG A/AA tags run here.
 *
 * Usage:
 *   const { container } = render(<Thing />);
 *   await expectNoA11yViolations(container);
 */
import axe from 'axe-core';

const AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return axe.run(container, {
    runOnly: { type: 'tag', values: AA_TAGS },
    rules: { 'color-contrast': { enabled: false } },
  });
}

export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const { violations } = await runAxe(container);
  if (violations.length === 0) return;

  const report = violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `      ${n.target.join(' ')} — ${(n.failureSummary ?? '').split('\n').join(' ')}`)
        .join('\n');
      return `  [${v.impact}] ${v.id}: ${v.help} (${v.helpUrl})\n${nodes}`;
    })
    .join('\n');

  throw new Error(`Found ${violations.length} accessibility violation(s):\n${report}`);
}
