/**
 * P78-C: the component-token tier and the framework constants.
 *
 * The tier's whole purpose is to be readable by something other than the
 * adapter, so the tests check emission across every bundled theme rather than
 * a single fixture: a derivation that throws on one palette and not another is
 * exactly the defect this tier exists to make visible.
 */
import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';

import {
  COMPONENT_TOKEN_DERIVATIONS,
  CONTROL_HEIGHTS,
  deriveComponentTokens,
  frameworkConstants,
  type ComponentTokenKey,
} from './componentTokens';
import { generateCssVariables, DEFAULT_CSS_VAR_PREFIX } from './cssVariables';
import { resolveColors } from './colorGen';
import { bundledThemeDefinitions, baseThemeDefaults } from './bundledThemes';
import type { ThemeColors, ThemeDefinition } from './types';

/** Merge a bundled extension onto the shared base, as the registry does. */
function fullDefinition(ext: unknown): ThemeDefinition {
  const base = JSON.parse(JSON.stringify(baseThemeDefaults));
  const e = JSON.parse(JSON.stringify(ext));
  return { ...base, ...e, colors: e.colors } as ThemeDefinition;
}

const ALL_TOKEN_NAMES: ComponentTokenKey[] = [
  ...(Object.keys(COMPONENT_TOKEN_DERIVATIONS) as ComponentTokenKey[]),
  ...(Object.keys(CONTROL_HEIGHTS) as ComponentTokenKey[]),
];

describe('component tokens across every bundled theme', () => {
  for (const ext of bundledThemeDefinitions) {
    const def = fullDefinition(ext);

    it(`${def.id}: emits every component token and framework constant`, () => {
      const rc = resolveColors(def.colors as ThemeColors, def.colorScheme);
      const css = generateCssVariables(rc, def);

      for (const name of ALL_TOKEN_NAMES) {
        expect(css, `${def.id} is missing ${name}`).toContain(
          `${DEFAULT_CSS_VAR_PREFIX}-${name}:`,
        );
      }
      for (const name of Object.keys(frameworkConstants(DEFAULT_CSS_VAR_PREFIX))) {
        expect(css, `${def.id} is missing ${name}`).toContain(
          `${DEFAULT_CSS_VAR_PREFIX}-${name}:`,
        );
      }
    });

    it(`${def.id}: every derived colour token parses as a colour`, () => {
      const rc = resolveColors(def.colors as ThemeColors, def.colorScheme);
      const tokens = deriveComponentTokens(rc);

      for (const name of Object.keys(COMPONENT_TOKEN_DERIVATIONS) as ComponentTokenKey[]) {
        const value = tokens[name];
        expect(value, `${def.id} ${name} is empty`).toBeTruthy();
        expect(
          chroma.valid(value),
          `${def.id} ${name} is not a colour: ${value}`,
        ).toBe(true);
      }
    });

    it(`${def.id}: control heights carry the measured Mantine scale`, () => {
      const rc = resolveColors(def.colors as ThemeColors, def.colorScheme);
      const tokens = deriveComponentTokens(rc);
      expect(tokens['control-height-xs']).toBe('1.875rem');
      expect(tokens['control-height-md']).toBe('2.625rem');
      expect(tokens['control-height-xl']).toBe('3.75rem');
    });
  }
});

describe('theme overrides', () => {
  const def = fullDefinition(bundledThemeDefinitions[0]);
  const rc = resolveColors(def.colors as ThemeColors, def.colorScheme);

  it('an explicit override wins over the derivation', () => {
    const derived = deriveComponentTokens(rc);
    const overridden = deriveComponentTokens(rc, { 'input-bd': '#ff0000' });
    expect(derived['input-bd']).not.toBe('#ff0000');
    expect(overridden['input-bd']).toBe('#ff0000');
    // Everything else is untouched.
    expect(overridden['input-bd-focus']).toBe(derived['input-bd-focus']);
  });

  it('a control height is overridable too', () => {
    expect(deriveComponentTokens(rc, { 'control-height-md': '2rem' })['control-height-md']).toBe(
      '2rem',
    );
  });

  it('generateCssVariables honours ThemeDefinition.componentTokens', () => {
    const themed: ThemeDefinition = { ...def, componentTokens: { 'table-hover-bg': '#123456' } };
    expect(generateCssVariables(rc, themed)).toContain(
      `${DEFAULT_CSS_VAR_PREFIX}-table-hover-bg: #123456;`,
    );
  });
});

describe('framework constants', () => {
  it('are identical across every bundled theme', () => {
    // The point of the tier: a theme cannot make the focus ring invisible by
    // making it thin, because geometry never resolves per palette.
    const reference = JSON.stringify(frameworkConstants(DEFAULT_CSS_VAR_PREFIX));
    for (const ext of bundledThemeDefinitions) {
      const def = fullDefinition(ext);
      const rc = resolveColors(def.colors as ThemeColors, def.colorScheme);
      const css = generateCssVariables(rc, def);
      for (const [name, value] of Object.entries(JSON.parse(reference))) {
        expect(css, `${def.id} changed ${name}`).toContain(
          `${DEFAULT_CSS_VAR_PREFIX}-${name}: ${value};`,
        );
      }
    }
  });

  it('carries the P77-F ring geometry', () => {
    const c = frameworkConstants(DEFAULT_CSS_VAR_PREFIX);
    expect(c['focus-ring-width']).toBe('2px');
    expect(c['focus-ring-offset']).toBe('2px');
    expect(c['focus-halo-width']).toBe('6px');
  });

  it('orders the layer scale strictly upward', () => {
    const c = frameworkConstants(DEFAULT_CSS_VAR_PREFIX);
    const steps = Object.entries(c)
      .filter(([name]) => name.startsWith('layer-') && name !== 'layer-host-offset')
      .map(([name, value]) => {
        const match = /\+ (\d+)\)$/.exec(value);
        expect(match, `${name} is not an offset calc: ${value}`).not.toBeNull();
        return [name, Number(match![1])] as const;
      });
    expect(steps.length).toBeGreaterThan(4);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]![1], `${steps[i]![0]} is not above ${steps[i - 1]![0]}`).toBeGreaterThan(
        steps[i - 1]![1],
      );
    }
  });

  it('resolves the host offset through the caller’s prefix, not a hardcoded one', () => {
    // The namespace is parametrized for external consumers (P51-L); a layer
    // that referred to `--mullion-layer-host-offset` regardless would leave
    // every such consumer unable to escape its host chrome.
    const custom = frameworkConstants('--acme');
    expect(custom['layer-modal']).toContain('var(--acme-layer-host-offset, 0)');
    expect(custom['layer-modal']).not.toContain('--mullion');
  });
});
