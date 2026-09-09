/**
 * P77-A: static guards for the style-delivery contract.
 *
 * The contract (docs/guides/STYLING_GUIDE.md, "Style delivery contract")
 * says which delivery mechanism reaches which tree. Three of its rules can be
 * checked without a browser, and each check here was mutation-tested when it
 * landed (see the P77-A notes in docs/PHASE77_REPORT.md):
 *
 *  1. `global.scss` is delivered to the gallery tree only (shadow root under
 *     the shipped mount, document under a light mount). A selector in it that
 *     is not scoped under `.mullion-gallery` is either dead for portaled
 *     chrome or a leak into the host page, so every selector must carry that
 *     ancestor. Known-dead rules are listed explicitly until P77-C moves them.
 *  2. Every CSS module must be registered in `shadowStyles.ts` unless its
 *     consumer provably renders outside the shadow tree (portaled chrome).
 *     Vite injects module CSS into the document only; a module consumed inside
 *     the shadow tree and not registered is silently dead there.
 *  3. Mantine's `styles` prop is inline style. Nested keys such as `'&:hover'`
 *     are dropped by the DOM without error (P76-I-1), so no component-level
 *     `styles={...}` may carry one. This extends the adapter-level guard in
 *     src/themes/__tests__/adapter.test.ts to the 14 call sites in components.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import * as sass from 'sass';

const SRC = path.resolve(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Selector preludes from compiled (flat) CSS. Sass output has no nesting, so a
 * `{` is preceded either by an at-rule prelude or a selector list.
 */
function selectorsOf(css: string): string[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  let buf = '';
  for (const ch of noComments) {
    if (ch === '{') {
      const prelude = buf.trim();
      if (prelude && !prelude.startsWith('@')) out.push(prelude.replace(/\s+/g, ' '));
      buf = '';
    } else if (ch === '}' || ch === ';') {
      buf = '';
    } else {
      buf += ch;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. global.scss is gallery-tree only
// ---------------------------------------------------------------------------

/**
 * Rules aimed at Mantine parts without the `.mullion-gallery` ancestor. They
 * reach those parts only when the parts render inside the gallery tree (the
 * inline Admin panel) and are dead for every portaled surface (Settings
 * drawer, Modals, Select dropdowns). Measured 2026-09-09 in both mount modes.
 * P77-C moves them to `chrome-portable.scss`; delete the entry when it does,
 * because the second assertion below fails on a stale entry.
 */
const GLOBAL_SCSS_KNOWN_DEAD_UNTIL_P77C = [
  '.mullion-mantine-tabs-tab[data-active]',
  '.mullion-mantine-segmented-control-label[data-active]',
  '.mullion-mantine-select-option[data-selected]',
];

describe('global.scss reaches only the gallery tree', () => {
  const file = path.join(SRC, 'styles', 'global.scss');
  const css = sass.compileString(readFileSync(file, 'utf8'), { loadPaths: [path.dirname(file)] }).css;
  const selectors = selectorsOf(css);

  it('compiles to a non-trivial rule set', () => {
    expect(selectors.length).toBeGreaterThan(10);
  });

  it('scopes every selector under .mullion-gallery, or lists it as known-dead', () => {
    const offenders: string[] = [];
    for (const list of selectors) {
      for (const sel of list.split(',').map((s) => s.trim())) {
        const scoped = sel === '.mullion-gallery' || sel.startsWith('.mullion-gallery ') || sel.startsWith('.mullion-gallery.') || sel.startsWith('.mullion-gallery__') || sel.startsWith('.mullion-gallery--') || sel.startsWith('.mullion-gallery:');
        if (!scoped && !GLOBAL_SCSS_KNOWN_DEAD_UNTIL_P77C.includes(sel)) offenders.push(sel);
      }
    }
    expect(offenders, 'unscoped global.scss selectors cannot reach portaled chrome and leak into the host page under a light mount').toEqual([]);
  });

  it('keeps the known-dead list honest: every entry still exists in global.scss', () => {
    const flat = selectors.flatMap((l) => l.split(',').map((s) => s.trim()));
    const stale = GLOBAL_SCSS_KNOWN_DEAD_UNTIL_P77C.filter((s) => !flat.includes(s));
    expect(stale, 'remove entries from GLOBAL_SCSS_KNOWN_DEAD_UNTIL_P77C once the rule has moved').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. CSS modules are registered for the shadow root unless document-only
// ---------------------------------------------------------------------------

/**
 * Modules whose only consumers render outside the shadow tree. Keyed by path
 * relative to src/, value is the consumer that justifies it. A module listed
 * here that later gains a consumer inside the gallery tree becomes dead there
 * without any test noticing, so keep the justification specific.
 */
const DOCUMENT_ONLY_MODULES: Record<string, string> = {
  'components/Admin/TemplatePickerModal.module.scss':
    'TemplatePickerModal is a Mantine Modal (withinPortal default), so its cards render under document.body',
};

/**
 * Modules consumed inside the shadow tree that are NOT registered. Measured
 * dead in the shipped mount on 2026-09-09: the Admin panel renders inline in
 * the gallery tree, and the Media tab's grid shell and cards carry these
 * classes with no matching rule in the shadow root. Making them live changes
 * appearance (hover lift, focus ring, grid max-width), so it belongs to P77-C
 * with the global.scss rules. Delete the entry when C registers them.
 */
const MODULES_KNOWN_DEAD_UNTIL_P77C = [
  'components/Admin/MediaCard.module.scss',
  'components/Admin/MediaTab.module.scss',
];

describe('CSS modules are delivered to the tree that consumes them', () => {
  const modules = walk(SRC)
    .filter((f) => f.endsWith('.module.scss'))
    .map((f) => path.relative(SRC, f).split(path.sep).join('/'))
    .sort();
  const shadowStylesSource = readFileSync(path.join(SRC, 'shadowStyles.ts'), 'utf8');
  const registered = (rel: string) => shadowStylesSource.includes(`'./${rel}?inline'`);

  it('finds the module files', () => {
    expect(modules.length).toBeGreaterThan(3);
  });

  it('registers every module in shadowStyles.ts unless it is document-only or known-dead', () => {
    const unaccounted = modules.filter(
      (m) => !registered(m) && !(m in DOCUMENT_ONLY_MODULES) && !MODULES_KNOWN_DEAD_UNTIL_P77C.includes(m),
    );
    expect(
      unaccounted,
      'a CSS module not concatenated into shadowStyles.ts never reaches the shadow tree; register it, or list it in DOCUMENT_ONLY_MODULES with the consumer that justifies it',
    ).toEqual([]);
  });

  it('does not list a registered module as document-only or dead', () => {
    const contradictions = [...Object.keys(DOCUMENT_ONLY_MODULES), ...MODULES_KNOWN_DEAD_UNTIL_P77C].filter(registered);
    expect(contradictions).toEqual([]);
  });

  it('keeps the allowlists pointing at files that exist', () => {
    const missing = [...Object.keys(DOCUMENT_ONLY_MODULES), ...MODULES_KNOWN_DEAD_UNTIL_P77C].filter((m) => !modules.includes(m));
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. No component-level styles={} carries a nested selector
// ---------------------------------------------------------------------------

/** Returns the balanced `{...}` blocks that follow every `styles={` in a source file. */
function stylesPropBlocks(source: string): string[] {
  const blocks: string[] = [];
  const re = /\bstyles=\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    blocks.push(source.slice(start, i - 1));
  }
  return blocks;
}

describe('component styles props contain no nested selectors', () => {
  // Keys like '&:hover', '&::before', ':focus-visible', '[data-active]'.
  const NESTED_KEY = /['"`]\s*(&|:{1,2}[a-z-]+|\[data-)/;
  const files = walk(SRC).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !f.endsWith('.stories.tsx'));

  it('scans the component tree', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('finds no nested key inside any styles={...} block', () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const block of stylesPropBlocks(readFileSync(f, 'utf8'))) {
        const hit = NESTED_KEY.exec(block);
        if (hit) offenders.push(`${path.relative(SRC, f)}: ${hit[0].trim()}`);
      }
    }
    expect(
      offenders,
      'Mantine styles={} is inline style; a pseudo-selector or attribute key is dropped silently. Use vars or classNames + chrome-portable.scss',
    ).toEqual([]);
  });
});
