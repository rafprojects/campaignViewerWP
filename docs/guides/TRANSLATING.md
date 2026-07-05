# Translating WP Super Gallery

This guide explains how to add a new language for **both** surfaces of the plugin:

- the **PHP-rendered** admin/server strings (standard WordPress gettext), and
- the **React front-end** (auth bar, login, lightbox, galleries, layout output),
  which runs on [i18next](https://www.i18next.com/).

Thanks to the P60-G bridge, **both are translated from a single `.po` file per
locale** — there is no separate React translation format to maintain.

---

## How it works (the bridge)

The React UI uses i18next keys (e.g. `auth_admin_menu_label`), whose English
defaults are the single source of truth in [`src/i18n-strings.en.json`](../../src/i18n-strings.en.json).

`scripts/generate-frontend-i18n.mjs` turns that JSON into a generated PHP
manifest, [`includes/i18n/class-wpsg-frontend-strings.php`](../../wp-plugin/wp-super-gallery/includes/i18n/class-wpsg-frontend-strings.php),
in which every key maps to its English default wrapped in `__()`:

```php
'auth_admin_menu_label' => __('Admin menu', 'wp-super-gallery'),
```

That single manifest does two jobs:

1. **Harvest** — `wp i18n make-pot` scans the `__()` calls, so the React strings
   land in `languages/wp-super-gallery.pot` alongside the PHP strings.
2. **Runtime** — on each page load, `WPSG_Frontend_Strings::get_translated()`
   resolves each key to the active locale's translation and PHP injects the map
   into `window.__WPSG_I18N__.strings`. `src/i18n.ts` feeds that to i18next,
   falling back to the bundled English per-key for anything untranslated.

```
src/i18n-strings.en.json  ──generate──▶  class-wpsg-frontend-strings.php
        (key → English)                        (key → __(English))
                                                   │           │
                                        make-pot   │           │  runtime
                                                   ▼           ▼
                                     wp-super-gallery.pot   window.__WPSG_I18N__
                                     (PHP + React strings)   → i18next (fallback: en)
```

> **Never edit `class-wpsg-frontend-strings.php` by hand.** It is generated.
> After changing `src/i18n-strings.en.json`, run `npm run i18n:generate` and
> commit the result. CI (`npm run i18n:check`) fails if the two drift apart.

---

## Adding a language

Prerequisites: [WP-CLI](https://wp-cli.org/) with the i18n command
(`wp i18n --help`). Locale codes follow WordPress conventions (e.g. `fr_FR`,
`de_DE`, `es_ES`).

1. **Regenerate the template** (only needed if strings changed since the last
   release):

   ```bash
   npm run i18n:generate                 # refresh the PHP manifest
   wp i18n make-pot wp-plugin/wp-super-gallery \
     wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot \
     --domain=wp-super-gallery \
     --exclude=node_modules,vendor,tests,build
   ```

2. **Create the locale `.po`** from the template, e.g. for German:

   ```bash
   cp wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot \
      wp-plugin/wp-super-gallery/languages/wp-super-gallery-de_DE.po
   ```

   Then translate each `msgstr` (with [Poedit](https://poedit.net/),
   [Loco Translate](https://wordpress.org/plugins/loco-translate/), or by hand).
   Add the header fields shown in `wp-super-gallery-fr_FR.po` (`Language`,
   `Plural-Forms`, `Content-Type: … charset=UTF-8`).

3. **Compile** the runtime binaries:

   ```bash
   wp i18n make-mo  wp-plugin/wp-super-gallery/languages   # → .mo (all locales)
   wp i18n make-php wp-plugin/wp-super-gallery/languages   # → .l10n.php (WP 6.5+ fast format)
   ```

4. **Commit** the `.po`, `.mo`, and `.l10n.php`. They ship automatically in the
   release ZIP (the `languages/` directory is not excluded).

5. **Verify** by setting **Settings → General → Site Language** in WordPress to
   the new locale and loading a gallery + the admin panel. Untranslated strings
   should show English.

**Five complete reference locales ship** — **French (`fr_FR`)**, **Spanish
(`es_ES`)**, **German (`de_DE`)**, **Simplified Chinese (`zh_CN`)**, and **Russian
(`ru_RU`)** — each with all ~2,160 strings translated across the PHP surface, the
customer-facing React front-end, **and the full React admin panel** (campaigns,
media, settings, access, audit, analytics, spaces, taxonomy, templates, and the
Layout Builder). Use any `.po` as a worked example.

> **Russian plural nuance.** `ru_RU` ships correct gettext 3-form plurals, but the
> React i18next plural keys only encode `_one`/`_other`, so counts 2–4 use the
> `_other` (genitive-plural) form instead of the ideal `_few` form. Full 3-form
> React correctness needs `_few`/`_many` keys added to `src/i18n-strings.en.json`
> (a source-layer enhancement); the PHP/gettext side is already correct.

> These reference locales are AI-authored for QA and a translation head-start;
> have a native speaker review them before relying on them in production.

---

## Notes & gotchas

- **Interpolation.** i18next placeholders like `{{email}}`, `{{count}}`,
  `{{title}}` must be preserved verbatim in the translation — they are filled in
  client-side. Do **not** translate the text inside `{{ }}`.
- **Shared strings.** Identical English strings share one `msgid` (e.g. "Sign
  in" is used by several keys), so one translation covers all of them.
- **Plurals.** A few keys come in pairs (`login_password_error` /
  `login_password_error_other`); i18next chooses between them client-side by
  `{{count}}`. Translate each variant as an independent string.
- **Admin panel.** The React **admin panel** strings (`src/components/Admin/**`)
  are fully harvested and translated as of Phase 60 track I (see
  `docs/PHASE60_REPORT.md`). The `i18next/no-literal-string` lint rule is enforced
  as an error across `src/components/Admin/**`, so new admin UI cannot ship an
  untranslated literal.
- **Lint enforcement.** Because the rule runs in `jsx-text-only` mode, it flags
  hardcoded JSX **text children** but not attribute strings (`title`, `aria-label`,
  `placeholder`, …). Wrap those by hand — the reference locales already do.
