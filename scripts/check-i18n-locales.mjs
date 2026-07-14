#!/usr/bin/env node
/**
 * check-i18n-locales.mjs — reference-locale translation-coverage gate.
 *
 * `i18n:check` (generate-frontend-i18n.mjs --check) only proves the English
 * source (src/i18n-strings.en.json) and the generated PHP manifest agree. It
 * says nothing about whether the reference locales actually TRANSLATE those
 * strings — so a new user-facing string can ship English-only (added to the en
 * source + manifest, never harvested into the .po/.mo), silently falling back
 * to English for every non-English site. That is exactly the P62-A regression
 * this gate closes.
 *
 * For every front-end source string (a value in i18n-strings.en.json) this
 * asserts each reference locale's .po contains that msgid with a non-empty,
 * non-fuzzy msgstr. It reads the committed .po files directly (the .mo/.l10n.php
 * are compiled from them), so it catches the gap before the binaries are built.
 *
 * Exit code: 0 = every locale complete; 1 = at least one missing/untranslated
 * string (details printed). Run via `npm run i18n:check:locales`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EN_JSON = path.join(ROOT, 'src', 'i18n-strings.en.json');
const LANG_DIR = path.join(ROOT, 'wp-plugin', 'wp-super-gallery', 'languages');

/** Reference locales that ship complete (see docs/guides/TRANSLATING.md). */
const LOCALES = ['de_DE', 'es_ES', 'fr_FR', 'ru_RU', 'zh_CN'];

/** How many missing/untranslated examples to print per locale before eliding. */
const SAMPLE = 20;

function unescapePo(s) {
  return s.replace(/\\(["\\ntr])/g, (_, c) => {
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    if (c === 'r') return '\r';
    return c; // " or \
  });
}

/**
 * Parse a .po file into { map: msgid -> { msgstr, fuzzy } }.
 * Handles multi-line strings and plural entries (singular msgid keyed to
 * msgstr[0]). The header entry (empty msgid) is skipped.
 */
function parsePo(text) {
  const map = new Map();
  const blocks = text.split(/\r?\n[ \t]*\r?\n/);
  for (const block of blocks) {
    let cur = null; // 'msgid' | 'msgstr' | 'ignore'
    let msgid = '';
    let msgstr = '';
    let sawMsgid = false;
    let fuzzy = false;
    for (const raw of block.split(/\r?\n/)) {
      const line = raw.trim();
      if (line === '') continue;
      if (line.startsWith('#')) {
        if (line.startsWith('#,') && line.includes('fuzzy')) fuzzy = true;
        continue;
      }
      let m;
      if ((m = line.match(/^msgid\s+"(.*)"$/s))) {
        cur = 'msgid';
        msgid = m[1];
        sawMsgid = true;
      } else if (/^msgid_plural\s+"/.test(line)) {
        cur = 'ignore';
      } else if ((m = line.match(/^msgstr(?:\[0\])?\s+"(.*)"$/s))) {
        cur = 'msgstr';
        msgstr = m[1];
      } else if (/^msgstr\[\d+\]\s+"/.test(line)) {
        cur = 'ignore';
      } else if ((m = line.match(/^"(.*)"$/s))) {
        if (cur === 'msgid') msgid += m[1];
        else if (cur === 'msgstr') msgstr += m[1];
      }
    }
    if (sawMsgid && msgid !== '') {
      map.set(unescapePo(msgid), { msgstr: unescapePo(msgstr), fuzzy });
    }
  }
  return map;
}

function main() {
  const en = JSON.parse(fs.readFileSync(EN_JSON, 'utf8'));
  // Front-end source strings = the English values. Dedup (shared strings map to
  // one msgid) and drop empties (e.g. an intentionally blank value).
  const sources = [...new Set(
    Object.values(en).filter((v) => typeof v === 'string' && v !== ''),
  )];

  let failed = false;
  const summary = [];

  for (const loc of LOCALES) {
    const poPath = path.join(LANG_DIR, `wp-super-gallery-${loc}.po`);
    if (!fs.existsSync(poPath)) {
      failed = true;
      summary.push(`${loc}: MISSING .po file (${poPath})`);
      continue;
    }
    const po = parsePo(fs.readFileSync(poPath, 'utf8'));
    const missing = [];
    const untranslated = [];
    const fuzzy = [];
    for (const src of sources) {
      const entry = po.get(src);
      if (!entry) missing.push(src);
      else if (entry.fuzzy) fuzzy.push(src);
      else if (entry.msgstr.trim() === '') untranslated.push(src);
    }
    const bad = missing.length + untranslated.length + fuzzy.length;
    if (bad === 0) {
      summary.push(`${loc}: ✓ ${sources.length} strings translated`);
    } else {
      failed = true;
      summary.push(
        `${loc}: ✗ ${bad} of ${sources.length} strings not translated ` +
        `(${missing.length} missing msgid, ${untranslated.length} empty msgstr, ${fuzzy.length} fuzzy)`,
      );
      const show = (label, arr) => {
        if (!arr.length) return;
        summary.push(`    ${label}:`);
        for (const s of arr.slice(0, SAMPLE)) {
          summary.push(`      - ${JSON.stringify(s.length > 80 ? s.slice(0, 77) + '…' : s)}`);
        }
        if (arr.length > SAMPLE) summary.push(`      … and ${arr.length - SAMPLE} more`);
      };
      show('missing msgid (never harvested into this locale)', missing);
      show('empty msgstr (untranslated)', untranslated);
      show('fuzzy (excluded from the compiled .mo)', fuzzy);
    }
  }

  console.log('Reference-locale translation coverage (front-end strings):');
  console.log(`  source: ${sources.length} unique English strings from src/i18n-strings.en.json\n`);
  console.log(summary.join('\n'));

  if (failed) {
    console.error(
      '\n✗ i18n locale coverage incomplete. After adding front-end strings, run:\n' +
      '    npm run i18n:generate\n' +
      '    wp i18n make-pot wp-plugin/wp-super-gallery wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot --domain=wp-super-gallery --exclude=node_modules,vendor,tests,build\n' +
      '  then translate the new msgstr in each languages/wp-super-gallery-*.po and recompile:\n' +
      '    wp i18n make-mo  wp-plugin/wp-super-gallery/languages\n' +
      '    wp i18n make-php wp-plugin/wp-super-gallery/languages\n' +
      '  See docs/guides/TRANSLATING.md.',
    );
    process.exit(1);
  }
  console.log('\n✓ All reference locales fully translate the front-end strings.');
}

main();
