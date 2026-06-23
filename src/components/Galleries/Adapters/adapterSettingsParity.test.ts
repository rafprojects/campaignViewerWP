/**
 * P55-C: Adapter fields schema contract guard (replaces P31-D regex parity test).
 *
 * Single source of truth: wp-plugin/.../schema/adapter-fields.json
 *
 * Checks:
 *  1. Schema is readable and has the expected number of fields.
 *  2. Every schema camelKey matches the deterministic camelCase→snake_case rule.
 *  3. Every TS registry field key is in the schema (no missing schema entries).
 *  4. Every schema camelKey is in the TS registry (no orphan schema entries).
 *  5. Every schema snakeSlug is registered in PHP $defaults.
 *  6. Every canonical adapter id is in WPSG_CPT::VALID_ADAPTERS.
 *  7. PHP sanitizer sources adapter map from WPSG_Adapter_Field_Schema (not a hand-maintained array).
 *  8. Legacy orphan keys were pruned and are absent from the schema.
 *
 * Run: npx vitest run adapterSettingsParity
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { SETTING_GROUP_DEFINITIONS } from '../../../data/adapterSettingGroups';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const root = resolve(__dirname, '../../../../');

function readSource(relPath: string): string {
  return readFileSync(resolve(root, relPath), 'utf8');
}

// ─── Schema ──────────────────────────────────────────────────────────────────

interface SchemaField {
  camelKey: string;
  snakeSlug: string;
}

const schemaPath = 'wp-plugin/wp-super-gallery/includes/schema/adapter-fields.json';
const schema: { version: string; fields: SchemaField[] } = JSON.parse(readSource(schemaPath));
const schemaFields = schema.fields;
const schemaCamelKeys = new Set(schemaFields.map((f) => f.camelKey));

// ─── TS registry keys (runtime traversal, no regex) ──────────────────────────

function extractRegistryKeys(): string[] {
  const keys: string[] = [];
  for (const group of Object.values(SETTING_GROUP_DEFINITIONS)) {
    for (const field of group.fields) {
      keys.push(field.key as string);
      if ('unitKey' in field && typeof (field as { unitKey?: string }).unitKey === 'string') {
        keys.push((field as { unitKey: string }).unitKey);
      }
    }
  }
  return [...new Set(keys)].sort();
}

const registryKeys = extractRegistryKeys();

// ─── Shared helpers ───────────────────────────────────────────────────────────

function toSnakeCase(camel: string): string {
  return camel.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('adapter fields schema contract (P55-C)', () => {

  it('schema is readable and has the expected field count', () => {
    expect(schema.version).toBe('1');
    expect(schemaFields.length).toBeGreaterThan(80);
    expect(schemaFields.length).toBe(registryKeys.length);
  });

  it('every schema camelKey matches the camelCase→snake_case transform rule', () => {
    const mismatches = schemaFields.filter((f) => toSnakeCase(f.camelKey) !== f.snakeSlug);
    expect(mismatches, [
      'The following schema entries have snakeSlug values that do not match the',
      'deterministic camelCase→snake_case transform. Fix the snakeSlug in the schema:',
      ...mismatches.map((f) => `  '${f.camelKey}': expected '${toSnakeCase(f.camelKey)}', got '${f.snakeSlug}'`),
    ].join('\n')).toHaveLength(0);
  });

  it('every TS registry field key is in the schema', () => {
    const missing = registryKeys.filter((k) => !schemaCamelKeys.has(k));
    expect(missing, [
      'One or more TS adapter setting keys are missing from adapter-fields.json.',
      'Add the following entries to the schema:',
      ...missing.map((k) => `  { "camelKey": "${k}", "snakeSlug": "${toSnakeCase(k)}" }`),
    ].join('\n')).toHaveLength(0);
  });

  it('every schema camelKey is in the TS registry (no orphan schema entries)', () => {
    const registryKeySet = new Set(registryKeys);
    const orphans = schemaFields.filter((f) => !registryKeySet.has(f.camelKey));
    expect(orphans, [
      'The following schema entries have no matching TS registry key.',
      'Remove them from adapter-fields.json or add the field to SETTING_GROUP_DEFINITIONS:',
      ...orphans.map((f) => `  '${f.camelKey}'`),
    ].join('\n')).toHaveLength(0);
  });

  it('every schema snakeSlug is registered in PHP $defaults', () => {
    const registryPhpSource = readSource(
      'wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php',
    );
    const defaultsStart = registryPhpSource.indexOf('private static $defaults = [');
    const defaultsEnd   = registryPhpSource.indexOf('\n    ];', defaultsStart);
    const defaultsBlock = registryPhpSource.slice(defaultsStart, defaultsEnd);
    const defaultKeys   = new Set(
      [...defaultsBlock.matchAll(/'([a-z][a-z0-9_]*)'\s*=>/g)].map((m) => m[1]),
    );

    const missing = schemaFields.filter((f) => !defaultKeys.has(f.snakeSlug));
    expect(missing, [
      'One or more schema snakeSlugs are missing from $defaults in',
      'class-wpsg-settings-registry.php. The nested sanitizer rejects any slug',
      'absent from $defaults, so these values are silently dropped on save.',
      'Add a default (and valid_options / field_ranges where applicable) for:',
      ...missing.map((f) => `  '${f.snakeSlug}' (from camelKey '${f.camelKey}'),`),
    ].join('\n')).toHaveLength(0);
  });

  it('every canonical adapter id is in WPSG_CPT::VALID_ADAPTERS', () => {
    const dataSource = readSource('src/data/adapterSettingGroups.ts');
    const cptSource  = readSource('wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php');

    const adaptersBlockStart = dataSource.indexOf('const BUILTIN_ADAPTERS');
    const adaptersBlockEnd   = dataSource.indexOf('\n];', adaptersBlockStart);
    const adaptersBlock      = dataSource.slice(adaptersBlockStart, adaptersBlockEnd);
    const registryIds        = [...adaptersBlock.matchAll(/^\s*id:\s*'([^']+)'/gm)].map((m) => m[1]);

    const validStart = cptSource.indexOf('const VALID_ADAPTERS = [');
    const validEnd   = cptSource.indexOf('];', validStart);
    const validBlock = cptSource.slice(validStart, validEnd);
    const phpIds     = [...validBlock.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

    expect(registryIds.length).toBeGreaterThan(10);
    expect(phpIds.length).toBeGreaterThan(10);

    const missing = registryIds.filter((id) => !phpIds.includes(id));
    expect(missing, [
      'One or more adapter ids are in the TS registry but missing from',
      'WPSG_CPT::VALID_ADAPTERS. Add to class-wpsg-cpt.php:',
      ...missing.map((id) => `  '${id}',`),
    ].join('\n')).toHaveLength(0);
  });

  it('PHP sanitizer sources adapter map from WPSG_Adapter_Field_Schema, not a hand-maintained array', () => {
    const sanitizerSource = readSource(
      'wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php',
    );
    expect(sanitizerSource).toContain('WPSG_Adapter_Field_Schema::get_map()');
    expect(sanitizerSource).not.toContain("private static $nested_adapter_field_map = [");
  });

  it('legacy orphan keys were pruned from the schema', () => {
    const prunedKeys = [
      'gridCardHeight',
      'gridCardHeightUnit',
      'mosaicTargetRowHeightUnit',
      'photoNormalizeHeightUnit',
    ];
    const stillPresent = prunedKeys.filter((k) => schemaCamelKeys.has(k));
    expect(stillPresent, [
      'Legacy orphan keys should have been pruned from adapter-fields.json.',
      'Remove the following entries:',
      ...stillPresent.map((k) => `  '${k}'`),
    ].join('\n')).toHaveLength(0);
  });
});
