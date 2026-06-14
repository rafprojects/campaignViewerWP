/**
 * P31-D: Adapter settings parity regression test.
 *
 * Verifies that every adapter setting key declared in SETTING_GROUP_DEFINITIONS
 * (including unitKey companions from dimension controls) is present in the PHP
 * nested adapter field map in class-wpsg-settings-sanitizer.php.
 *
 * Also validates that the camelCase→snake_case transform rule is correct for
 * all registry keys that appear in the PHP map.
 *
 * Run: npx vitest run adapterSettingsParity
 * Or via CI: npm test (included in the full suite)
 *
 * If this test fails, a new adapter setting was added to the registry without
 * updating the PHP sanitizer map. Add the missing entry and re-run.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { describe, expect, it } from 'vitest';

// ─── Source file paths ────────────────────────────────────────────────────────

// ESM-safe equivalent of __dirname (package.json has "type": "module")
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const root = resolve(__dirname, '../../../../');

function readSource(relPath: string): string {
  return readFileSync(resolve(root, relPath), 'utf8');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract all field `key` and `unitKey` string literals from the
 * SETTING_GROUP_DEFINITIONS block in adapterRegistry.ts.
 */
function extractRegistryKeys(source: string): string[] {
  const start = source.indexOf('const SETTING_GROUP_DEFINITIONS');
  const end   = source.indexOf('\nfor (', start);
  const block = source.slice(start, end);

  const fieldKeys = [...block.matchAll(/\bkey:\s*'([^']+)'/g)].map((m) => m[1]);
  const unitKeys  = [...block.matchAll(/\bunitKey:\s*'([^']+)'/g)].map((m) => m[1]);

  return [...new Set([...fieldKeys, ...unitKeys])].sort();
}

/**
 * Extract the key→slug pairs from the PHP $nested_adapter_field_map array.
 */
function extractPhpMap(source: string): Record<string, string> {
  const start = source.indexOf('$nested_adapter_field_map = [');
  const end   = source.indexOf('\n    ];', start);
  const block = source.slice(start, end);

  const pairs = [...block.matchAll(/'([a-zA-Z][a-zA-Z0-9]*)'\s*=>\s*'([a-z_]+)'/g)];
  return Object.fromEntries(pairs.map((m) => [m[1], m[2]]));
}

/**
 * Deterministic camelCase → snake_case used by the PHP sanitizer and the
 * future code generator.
 *
 * Examples:
 *   carouselVisibleCards     → carousel_visible_cards
 *   scrollSnapAlignment      → scroll_snap_alignment
 *   spotlightThumbnailSizeUnit → spotlight_thumbnail_size_unit
 */
function toSnakeCase(camel: string): string {
  return camel.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('adapter settings parity (P31-D)', () => {
  const registrySource = readSource('src/components/Galleries/Adapters/adapterRegistry.ts');
  const phpSource      = readSource(
    'wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php',
  );

  const registryKeys = extractRegistryKeys(registrySource);
  const phpMap       = extractPhpMap(phpSource);
  const phpKeys      = Object.keys(phpMap);

  it('locates SETTING_GROUP_DEFINITIONS in the registry source', () => {
    expect(registryKeys.length).toBeGreaterThan(50);
  });

  it('locates $nested_adapter_field_map in the PHP sanitizer source', () => {
    expect(phpKeys.length).toBeGreaterThan(50);
  });

  it('every registry adapter setting key is present in the PHP sanitizer map', () => {
    const missing = registryKeys.filter((k) => !phpKeys.includes(k));

    expect(missing, [
      'One or more adapter setting keys are in the registry but missing from the',
      'PHP nested adapter field map. Add the following entries to',
      'class-wpsg-settings-sanitizer.php $nested_adapter_field_map:',
      ...missing.map((k) => `  '${k}' => '${toSnakeCase(k)}',`),
    ].join('\n')).toHaveLength(0);
  });

  it('snake_case transformation matches PHP map entries for all registry keys', () => {
    const mismatches = registryKeys
      .filter((k) => phpKeys.includes(k))
      .filter((k) => phpMap[k] !== toSnakeCase(k));

    expect(mismatches, [
      'The following registry keys have incorrect snake_case entries in the PHP map:',
      ...mismatches.map((k) => `  '${k}': expected '${toSnakeCase(k)}', PHP has '${phpMap[k]}'`),
    ].join('\n')).toHaveLength(0);
  });

  // P50-C: adapter-id allowlist parity. P48 registered coverflow/pinterest in
  // the TS registry without adding them to WPSG_CPT::VALID_ADAPTERS, so the
  // PHP sanitizer silently dropped those adapterId values on save. This guard
  // keeps the two lists in sync for every future adapter.
  it('every canonical registry adapter id is present in WPSG_CPT::VALID_ADAPTERS', () => {
    const cptSource = readSource('wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php');

    const adaptersBlockStart = registrySource.indexOf('const BUILTIN_ADAPTERS');
    const adaptersBlockEnd   = registrySource.indexOf('\n];', adaptersBlockStart);
    const adaptersBlock      = registrySource.slice(adaptersBlockStart, adaptersBlockEnd);
    const registryIds        = [...adaptersBlock.matchAll(/^\s*id:\s*'([^']+)'/gm)].map((m) => m[1]);

    const validStart = cptSource.indexOf('const VALID_ADAPTERS = [');
    const validEnd   = cptSource.indexOf('];', validStart);
    const validBlock = cptSource.slice(validStart, validEnd);
    const phpIds     = [...validBlock.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

    expect(registryIds.length).toBeGreaterThan(10);
    expect(phpIds.length).toBeGreaterThan(10);

    const missing = registryIds.filter((id) => !phpIds.includes(id));
    expect(missing, [
      'One or more adapter ids are registered in the TS adapter registry but',
      'missing from WPSG_CPT::VALID_ADAPTERS, so the PHP sanitizer will drop',
      'them from saved gallery configs. Add to class-wpsg-cpt.php:',
      ...missing.map((id) => `  '${id}',`),
    ].join('\n')).toHaveLength(0);
  });

  // P51-E: Every adapter-map slug must also exist as a key in the registry
  // $defaults array. The nested sanitizer gates on array_key_exists($flat_key,
  // $defaults) (sanitize_nested_gallery_setting), so a slug present in the field
  // map but absent from $defaults is silently dropped on save for both global
  // gallery_config and per-campaign galleryOverrides. This guard caught the
  // Spotlight / Scroll-snap / Masonry-entrance persistence gap.
  it('every PHP adapter field-map slug is registered in $defaults', () => {
    const registryPhpSource = readSource(
      'wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php',
    );

    const defaultsStart = registryPhpSource.indexOf('private static $defaults = [');
    const defaultsEnd   = registryPhpSource.indexOf('\n    ];', defaultsStart);
    const defaultsBlock = registryPhpSource.slice(defaultsStart, defaultsEnd);
    const defaultKeys   = new Set(
      [...defaultsBlock.matchAll(/'([a-z][a-z0-9_]*)'\s*=>/g)].map((m) => m[1]),
    );

    const slugs   = Object.values(phpMap);
    const missing = slugs.filter((slug) => !defaultKeys.has(slug));

    expect(missing, [
      'One or more adapter field-map slugs are missing from $defaults in',
      'class-wpsg-settings-registry.php. The nested sanitizer rejects any slug',
      'absent from $defaults, so these values are silently dropped on save.',
      'Add a default (and valid_options / field_ranges where applicable) for:',
      ...[...new Set(missing)].map((slug) => `  '${slug}' => ...,`),
    ].join('\n')).toHaveLength(0);
  });

  it('identifies legacy PHP map entries that have no registry counterpart', () => {
    // These are known orphan entries from formerly-dimension fields whose *Unit
    // companions were left in the PHP map when the control type changed to number.
    // They are harmless but should not grow without a matching registry change.
    const knownLegacyKeys = [
      'gridCardHeight',
      'gridCardHeightUnit',
      'mosaicTargetRowHeightUnit',
      'photoNormalizeHeightUnit',
    ];

    const extraInPhp  = phpKeys.filter((k) => !registryKeys.includes(k));
    const newOrphans  = extraInPhp.filter((k) => !knownLegacyKeys.includes(k));

    expect(newOrphans, [
      'New PHP map entries were found with no registry counterpart.',
      'If these are intentional legacy entries, add them to knownLegacyKeys above.',
      'If they are stale, remove them from the PHP map.',
      ...newOrphans.map((k) => `  '${k}' => '${phpMap[k]}'`),
    ].join('\n')).toHaveLength(0);
  });
});
