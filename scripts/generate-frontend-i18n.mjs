#!/usr/bin/env node
/**
 * generate-frontend-i18n.mjs — P60-G
 *
 * Bridges the React (i18next) front-end string catalogue into the WordPress
 * gettext pipeline. Reads the canonical English source (src/i18n-strings.en.json)
 * and emits a generated PHP "strings manifest":
 *
 *   wp-plugin/wp-super-gallery/includes/i18n/class-wpsg-frontend-strings.php
 *
 * Each i18next key becomes an entry mapping to its English default wrapped in
 * __(), which achieves two things at once:
 *   1. `wp i18n make-pot` harvests the English defaults into the .pot, so a
 *      single .po/.mo per locale translates BOTH the PHP and React surfaces.
 *   2. WPSG_Frontend_Strings::get_translated() resolves the active-locale
 *      translation at runtime for injection into window.__WPSG_I18N__.strings.
 *
 * Usage:
 *   node scripts/generate-frontend-i18n.mjs           # (re)write the manifest
 *   node scripts/generate-frontend-i18n.mjs --check    # CI: fail if stale
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const SOURCE = path.join(projectRoot, 'src', 'i18n-strings.en.json');
const TARGET = path.join(
  projectRoot,
  'wp-plugin',
  'wp-super-gallery',
  'includes',
  'i18n',
  'class-wpsg-frontend-strings.php',
);
const TEXT_DOMAIN = 'wp-super-gallery';

/** Escape a JS string for embedding in a PHP single-quoted literal. */
function phpSingleQuote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function buildManifest(strings) {
  const entries = Object.entries(strings)
    .map(
      ([key, value]) =>
        `            ${phpSingleQuote(key)} => __(${phpSingleQuote(value)}, '${TEXT_DOMAIN}'),`,
    )
    .join('\n');

  return `<?php
/**
 * WPSG_Frontend_Strings — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate with: npm run i18n:generate
 * Source of truth: src/i18n-strings.en.json
 *
 * Bridges the React (i18next) front-end string catalogue into the WordPress
 * gettext pipeline. Each i18next key maps to its English default wrapped in
 * __(), so \`wp i18n make-pot\` harvests the strings into the .pot AND
 * get_translated() can resolve the active-locale translation for injection
 * into window.__WPSG_I18N__.strings (consumed by src/i18n.ts).
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Frontend_Strings {
    /**
     * i18next key => translated string for the current locale.
     *
     * @return array<string, string>
     */
    public static function get_translated(): array {
        return [
${entries}
        ];
    }
}
`;
}

function main() {
  const check = process.argv.includes('--check');
  const raw = fs.readFileSync(SOURCE, 'utf8');
  const strings = JSON.parse(raw);
  const output = buildManifest(strings);

  if (check) {
    const existing = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
    if (existing !== output) {
      console.error(
        '✗ class-wpsg-frontend-strings.php is stale. Run `npm run i18n:generate` and commit the result.',
      );
      process.exit(1);
    }
    console.log('✓ Front-end i18n manifest is up to date.');
    return;
  }

  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, output, 'utf8');
  console.log(
    `Generated ${path.relative(projectRoot, TARGET)} (${Object.keys(strings).length} strings).`,
  );
}

main();
