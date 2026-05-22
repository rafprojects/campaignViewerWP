#!/usr/bin/env node
/**
 * P31-D: Adapter Settings Parity Validator
 *
 * Reads SETTING_GROUP_DEFINITIONS from adapterRegistry.ts (via source
 * text parsing) and validates that every adapter setting key — including
 * unitKey companions from dimension controls — is present in the PHP
 * nested adapter field map in class-wpsg-settings-sanitizer.php.
 *
 * Also demonstrates the camelCase → snake_case generator transformation
 * that a Phase 32 code-generator would use to produce the PHP map entries
 * automatically.
 *
 * Usage:
 *   node scripts/validate-adapter-settings-parity.mjs
 *   npm run validate:adapter-settings
 *
 * Exit code: 0 = all registry keys present in PHP map
 *            1 = at least one registry key is missing from the PHP map
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ─── Parse registry keys ────────────────────────────────────────────────────

const registrySource = readFileSync(
  resolve(root, 'src/components/Galleries/Adapters/adapterRegistry.ts'),
  'utf8',
);

// Isolate the SETTING_GROUP_DEFINITIONS block so we don't accidentally pick up
// key references from adapter registration entries or function bodies.
const settingGroupsStart = registrySource.indexOf('const SETTING_GROUP_DEFINITIONS');
// The block ends right before the `for (const adapter of BUILTIN_ADAPTERS` loop.
const settingGroupsEnd = registrySource.indexOf('\nfor (', settingGroupsStart);
if (settingGroupsStart === -1 || settingGroupsEnd === -1) {
  console.error('✗ Could not locate SETTING_GROUP_DEFINITIONS block in adapterRegistry.ts');
  process.exit(1);
}
const settingGroupsBlock = registrySource.slice(settingGroupsStart, settingGroupsEnd);

// Extract field keys (key: 'someKey') and unit keys (unitKey: 'someKeyUnit').
const fieldKeyMatches   = [...settingGroupsBlock.matchAll(/\bkey:\s*'([^']+)'/g)];
const unitKeyMatches    = [...settingGroupsBlock.matchAll(/\bunitKey:\s*'([^']+)'/g)];

const registryKeys = [
  ...new Set([
    ...fieldKeyMatches.map((m) => m[1]),
    ...unitKeyMatches.map((m)  => m[1]),
  ]),
].sort();

// ─── Parse PHP map keys ──────────────────────────────────────────────────────

const phpSource = readFileSync(
  resolve(
    root,
    'wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php',
  ),
  'utf8',
);

// Isolate the $nested_adapter_field_map array.
const phpMapStart = phpSource.indexOf('$nested_adapter_field_map = [');
const phpMapEnd   = phpSource.indexOf('\n    ];', phpMapStart);
if (phpMapStart === -1 || phpMapEnd === -1) {
  console.error('✗ Could not locate $nested_adapter_field_map in class-wpsg-settings-sanitizer.php');
  process.exit(1);
}
const phpMapBlock = phpSource.slice(phpMapStart, phpMapEnd);

// Match 'camelCaseKey' => 'snake_case_key' pairs.
const phpPairs = [...phpMapBlock.matchAll(/'([a-zA-Z][a-zA-Z0-9]*)'\s*=>\s*'([a-z_]+)'/g)];
const phpKeys  = phpPairs.map((m) => m[1]);
const phpMap   = Object.fromEntries(phpPairs.map((m) => [m[1], m[2]]));

// ─── Generator transformation ────────────────────────────────────────────────

/**
 * Deterministic camelCase → snake_case transformation.
 * Matches the rule used by the PHP sanitizer map.
 *
 * Examples:
 *   carouselVisibleCards    → carousel_visible_cards
 *   scrollSnapAlignment     → scroll_snap_alignment
 *   spotlightHeroAspectRatio → spotlight_hero_aspect_ratio
 */
function toSnakeCase(camel) {
  return camel
    .replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`)
    .toLowerCase();
}

// ─── Parity analysis ─────────────────────────────────────────────────────────

// Keys in the registry that are missing from the PHP map — these are errors;
// they mean a new adapter setting was not wired through to PHP sanitization.
const missingFromPhp = registryKeys.filter((k) => !phpKeys.includes(k));

// Keys in the PHP map that are NOT in the current registry — these may be
// legacy entries (e.g., fields that were changed from dimension to number,
// leaving orphan *Unit keys).  We treat them as warnings, not errors.
const extraInPhp = phpKeys.filter((k) => !registryKeys.includes(k));

// Keys where the PHP value doesn't match the expected snake_case transform.
const transformMismatches = registryKeys
  .filter((k) => phpKeys.includes(k))
  .filter((k) => phpMap[k] !== toSnakeCase(k));

// ─── Report ──────────────────────────────────────────────────────────────────

const hr = '─'.repeat(60);
console.log(`\n${'═'.repeat(60)}`);
console.log('  Adapter Settings Parity Report  (P31-D)');
console.log(`${'═'.repeat(60)}\n`);

console.log(`Registry keys (field key + unitKey):  ${registryKeys.length}`);
console.log(`PHP sanitizer map keys:               ${phpKeys.length}`);
console.log();

// Transform preview — show 5 representative entries to validate the rule.
console.log('Generator transform preview (camelCase → snake_case):');
const previewKeys = [
  'carouselVisibleCards', 'scrollSnapAlignment', 'spotlightHeroAspectRatio',
  'masonryEntranceAnimation', 'gridCardWidthUnit',
].filter((k) => registryKeys.includes(k));
for (const k of previewKeys) {
  const generated = toSnakeCase(k);
  const actual    = phpMap[k] ?? '(not in PHP map)';
  const match     = generated === actual ? '✓' : '✗';
  console.log(`  ${match}  '${k}' → '${generated}'  (PHP has: '${actual}')`);
}
console.log();
console.log(hr);

let hasErrors = false;

if (transformMismatches.length > 0) {
  console.log('\n✗ snake_case transform mismatches (generator rule violated):');
  for (const k of transformMismatches) {
    console.log(`  '${k}'  expected: '${toSnakeCase(k)}'  actual PHP: '${phpMap[k]}'`);
  }
  hasErrors = true;
}

if (missingFromPhp.length > 0) {
  console.log('\n✗ Registry keys missing from PHP map — add these entries:');
  for (const k of missingFromPhp) {
    const snake = toSnakeCase(k);
    console.log(`  '${k}' => '${snake}',`);
  }
  hasErrors = true;
}

if (extraInPhp.length > 0) {
  console.log('\n⚠ PHP map entries with no registry counterpart (legacy/orphan):');
  for (const k of extraInPhp) {
    console.log(`  '${k}' => '${phpMap[k]}',`);
  }
  // Not treated as an error — legacy entries are intentionally kept.
}

console.log();
if (!hasErrors) {
  console.log('✓ All registry keys are present in the PHP sanitizer map.');
  if (transformMismatches.length === 0) {
    console.log('✓ All snake_case transformations are correct.');
  }
  console.log('\n→ Generator go-decision is validated: the derivation rule is correct');
  console.log('  and the current layers are in sync. Phase 32 can proceed.\n');
} else {
  console.log('✗ Parity check failed. Fix the entries listed above.\n');
  process.exit(1);
}
