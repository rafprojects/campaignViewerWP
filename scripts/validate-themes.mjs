#!/usr/bin/env node
/**
 * Build-time theme validation script (P30-I).
 *
 * Validates:
 *  1. All theme definition JSON files (src/themes/definitions/*.json)
 *     — required fields: id, name, colorScheme ('light' | 'dark')
 *  2. The shared theme catalog (wp-plugin/wp-super-gallery/theme-catalog.json)
 *     — required fields: id, name, colorScheme, group, description, displayOrder, seasonal
 *     — cross-check: every catalog entry has a matching definition file
 *
 * Exits with code 0 on success, code 1 on any validation failure.
 * Run via: node scripts/validate-themes.mjs
 * Or:      npm run validate:themes
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ✗ ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠ WARN:  ${msg}`);
  warnings++;
}

// ---------------------------------------------------------------------------
// 1. Theme definition files
// ---------------------------------------------------------------------------

console.log('\n── Theme definition files ──────────────────────────────────');

const defsDir = join(root, 'src/themes/definitions');
const allDefFiles = readdirSync(defsDir).filter((f) => f.endsWith('.json'));
const nonBaseFiles = allDefFiles.filter((f) => !f.startsWith('_'));

const registeredIds = new Set();

for (const file of allDefFiles) {
  const filePath = join(defsDir, file);
  let def;
  try {
    def = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    error(`[${file}] Could not parse JSON: ${e.message}`);
    continue;
  }

  if (file.startsWith('_')) {
    console.log(`  ℹ  [${file}] base defaults file — skipped`);
    continue;
  }

  const required = ['id', 'name', 'colorScheme'];
  for (const field of required) {
    if (!(field in def) || def[field] === null || def[field] === undefined) {
      error(`[${file}] Missing required field: ${field}`);
    }
  }

  if (def.colorScheme && !['light', 'dark'].includes(def.colorScheme)) {
    error(`[${file}] colorScheme must be 'light' or 'dark', got: ${def.colorScheme}`);
  }

  if (def.id && typeof def.id === 'string') {
    if (registeredIds.has(def.id)) {
      error(`[${file}] Duplicate theme ID: ${def.id}`);
    }
    registeredIds.add(def.id);
  }

  console.log(`  ✓  [${file}] id="${def.id}" colorScheme="${def.colorScheme}"`);
}

// ---------------------------------------------------------------------------
// 2. Theme catalog
// ---------------------------------------------------------------------------

console.log('\n── Theme catalog ────────────────────────────────────────────');

const catalogPath = join(root, 'wp-plugin/wp-super-gallery/theme-catalog.json');

if (!existsSync(catalogPath)) {
  error('theme-catalog.json not found at wp-plugin/wp-super-gallery/theme-catalog.json');
} else {
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  } catch (e) {
    error(`Could not parse theme-catalog.json: ${e.message}`);
    catalog = null;
  }

  if (Array.isArray(catalog)) {
    const requiredCatalogFields = ['id', 'name', 'colorScheme', 'group', 'description', 'displayOrder', 'seasonal'];
    const catalogIds = new Set();

    for (const entry of catalog) {
      const entryId = entry.id || '(unknown)';

      for (const field of requiredCatalogFields) {
        if (!(field in entry) || entry[field] === null || entry[field] === undefined) {
          error(`[catalog/${entryId}] Missing required field: ${field}`);
        }
      }

      if (entry.colorScheme && !['light', 'dark'].includes(entry.colorScheme)) {
        error(`[catalog/${entryId}] colorScheme must be 'light' or 'dark', got: ${entry.colorScheme}`);
      }

      if (typeof entry.displayOrder !== 'number' || !Number.isInteger(entry.displayOrder)) {
        error(`[catalog/${entryId}] displayOrder must be an integer`);
      }

      if (typeof entry.seasonal !== 'boolean') {
        error(`[catalog/${entryId}] seasonal must be a boolean`);
      }

      if (catalogIds.has(entryId)) {
        error(`[catalog] Duplicate ID: ${entryId}`);
      }
      catalogIds.add(entryId);

      // Cross-check: catalog entry must have a matching definition file
      if (!registeredIds.has(entryId)) {
        warn(`[catalog/${entryId}] No matching definition file found in src/themes/definitions/`);
      } else {
        // Cross-check colorScheme matches the definition file
        const defPath = join(defsDir, `${entryId}.json`);
        if (existsSync(defPath)) {
          try {
            const defJson = JSON.parse(readFileSync(defPath, 'utf8'));
            if (defJson.colorScheme && entry.colorScheme && defJson.colorScheme !== entry.colorScheme) {
              error(`[catalog/${entryId}] colorScheme mismatch: catalog says "${entry.colorScheme}" but definition says "${defJson.colorScheme}"`);
            }
          } catch { /* parse errors already reported above */ }
        }
      }
    }

    // Cross-check: every definition file should be in the catalog
    for (const id of registeredIds) {
      if (!catalogIds.has(id)) {
        warn(`[themes/${id}] Definition exists but is not in theme-catalog.json`);
      }
    }

    console.log(`  ✓  ${catalog.length} catalog entries`);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n────────────────────────────────────────────────────────────`);
console.log(`  ${nonBaseFiles.length} definition files  |  errors: ${errors}  |  warnings: ${warnings}`);

if (errors > 0) {
  console.error(`\n✗ Theme validation failed — ${errors} error(s)\n`);
  process.exit(1);
} else {
  console.log(`\n✓ Theme validation passed\n`);
}
