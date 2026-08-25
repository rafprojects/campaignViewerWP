/**
 * P62-G(g): assert the WordPress.org "free" build excludes all Pro authoring code.
 *
 * Run this AFTER a free build (`MULLION_PREMIUM=false npm run build`) — e.g. via
 * `npm run check:free-build`, which builds then checks. It fails (exit 1) if any
 * Pro-only marker appears in the scanned assets, which would mean the free build
 * ships locked functionality that WordPress.org disallows (guideline 5: no
 * restricted/locked code; a `__MULLION_PREMIUM__` regression).
 *
 * Default scan root is `./dist/assets` (what `npm run check:free-build` / `ci.yml`
 * use). Pass a directory as argv[2] to re-scan an already-built tree without
 * rebuilding — used by `release.yml` and `svn-deploy.yml` against the plugin
 * copy (`wp-plugin/mullion-gallery/assets`, which is `dist/` copied one level
 * down, so hashed chunks live in `assets/assets/`). The scan is recursive so
 * both layouts are covered; chunk-prefix checks use each file's basename.
 *
 * Markers are chosen to survive minification:
 *   - forbidden chunk filenames (Pro lazy chunks Rollup names after their module), and
 *   - code-literal strings unique to Pro features.
 * i18n default strings (e.g. lb_preset_desc) are intentionally NOT checked — they are
 * translation text, not locked code, and are WP.org-compliant (see PRO_FEATURES §7).
 *
 * See docs/guides/PRO_FEATURES.md §7 for the build-time split and the two-layer model.
 */
import { readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';

const DIST_ASSETS = process.argv[2] || './dist/assets';

// Pro lazy-chunk filename prefixes that must NOT exist in the free build.
const FORBIDDEN_CHUNK_PREFIXES = [
  'PresetGalleryModal', // P62-F: starter template library
  'TextPropertiesPanel', // P62-G(b): text-layer editor (+ heavyweight TypographyEditor)
];

// Code-literal strings (not i18n text) that must NOT appear in any free-build asset.
const FORBIDDEN_STRINGS = [
  'breakpoint-edit-selector', // P62-G(c): breakpoint switcher testid
  'fit-to-viewport', // P62-G(c): breakpoint fit button testid
  'Magazine Spread', // P62-F: starter-preset data (src/data/layoutPresets.ts)
];

function listJsFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const out = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = listJsFiles(full);
      if (nested) out.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

const jsFiles = listJsFiles(DIST_ASSETS);
if (jsFiles === null) {
  console.error(
    `FAIL — ${DIST_ASSETS} not found. Pass an existing assets directory, or run a free build first: MULLION_PREMIUM=false npm run build`,
  );
  process.exit(1);
}

if (jsFiles.length === 0) {
  console.error(`FAIL — no JS assets in ${DIST_ASSETS}; the build looks empty.`);
  process.exit(1);
}

const violations = [];

for (const prefix of FORBIDDEN_CHUNK_PREFIXES) {
  const hit = jsFiles.find((f) => {
    const name = basename(f);
    return name.startsWith(`${prefix}-`) || name === `${prefix}.js`;
  });
  if (hit) violations.push(`Pro chunk present: ${basename(hit)} (feature "${prefix}")`);
}

for (const file of jsFiles) {
  const content = readFileSync(file, 'utf-8');
  for (const needle of FORBIDDEN_STRINGS) {
    if (content.includes(needle)) violations.push(`Pro marker "${needle}" found in ${basename(file)}`);
  }
}

if (violations.length > 0) {
  console.error('FAIL — the free build contains Pro code that WordPress.org disallows:\n');
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    '\nGate the offending code behind `__MULLION_PREMIUM__` so Rollup strips it from the free build.\n' +
      'See docs/guides/PRO_FEATURES.md §7.',
  );
  process.exit(1);
}

console.log(
  `Free build is clean — no Pro chunks or markers across ${jsFiles.length} JS assets in ${DIST_ASSETS}.`,
);
