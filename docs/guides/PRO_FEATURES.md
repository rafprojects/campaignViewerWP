# WP Super Gallery — Pro Features: Decisions & Developer Guide

**Audience:** developers and maintainers. This explains **what "Pro" is** (the free/paid
boundary and the decisions behind it), **how the entitlement architecture works**, and **how to
add a new Pro feature** using the existing seams.

- To take the paid plugin to market, see [MARKETPLACE_READINESS.md](MARKETPLACE_READINESS.md).
- For the buyer-facing activation guide, see [LICENSE_ACTIVATION.md](LICENSE_ACTIVATION.md).

---

## 1. What "Pro" is

The **core gallery and the visual LayoutBuilder are free and fully functional.** A Pro license
unlocks exactly **three** advanced LayoutBuilder capabilities:

| Feature | What it unlocks | Origin |
|---|---|---|
| **Text layers** | Add and edit rich text layers on a layout | Phase 59 |
| **Per-breakpoint responsive editing** | Tune slot position/size independently for tablet & mobile | Phase 58-B |
| **Starter template library** | Start a layout from a curated preset instead of blank | Phase 58-C |

That's the entire paid surface today. Everything else ships free.

---

## 2. The free/pro boundary (decisions)

**What stays free:**

- **All 14 gallery adapters.** `AdapterRegistration`
  (`src/components/Galleries/Adapters/GalleryAdapter.ts`) has **no** `pro`/`premium` flag, and
  none of the adapters in `src/data/adapterSettingGroups.ts` are gated. Adapter-level gating was
  explicitly ruled **out of scope** (a Follow-On Candidate) — all adapters stay free.
- The **core builder**, campaigns, media, settings, access, analytics, spaces, taxonomy — free.

**Two orthogonal concepts — do not conflate them:**

| Concern | Class | On failure |
|---|---|---|
| **Who may call this route** (role/capability) | `WPSG_Permissions` | hard **403** |
| **Is this Pro feature unlocked** (entitlement/license) | `WPSG_License` | request **succeeds**, Pro payload silently **degrades** |

A permission failure blocks the request. An entitlement failure lets the request through but
strips/freezes the Pro data. Keep them separate — never fold entitlement into
`WPSG_Permissions`.

**Graceful degradation (a core design decision):** already-saved Pro content **always renders**,
for everyone, regardless of license. Only *new or edited* Pro content is gated:

- **create / import** while unlicensed → Pro fields **stripped** to empty.
- **update** while unlicensed → Pro fields **frozen** to the last-saved value (an edit is
  discarded, never destructive).

This means a lapsed or absent license never breaks or deletes a customer's existing layouts.

---

## 3. Architecture of the entitlement seam

```
PHP (server)                                   Client (React)
────────────                                   ──────────────
WPSG_License::can_use_premium_code()  ─┐
WPSG_License::get_tier()               ├─► WPSG_Embed::page_config_js()
WPSG_License::get_upgrade_url()        ─┘        │  'license' block
                                                 ▼
                                        window.__WPSG_CONFIG__.license
                                                 │
                                                 ▼
                                        useWpsgLicense()  → { isPro, tier, upgradeUrl }
                                                 │
                          ┌──────────────────────┴───────────────────────┐
                          ▼                                               ▼
              server enforcement:                             client gate:
              enforce_license_gates()                         if (!isPro) showProUpsell(...)
              (strip/freeze persisted fields)                 (UX only — bypassable)
```

**Reusable seams:**

| Concern | Symbol | File |
|---|---|---|
| Declare a feature | `FEATURE_*` const + `can_use_feature()` | `includes/class-wpsg-license.php` |
| Per-feature override | filter `wpsg_license_feature_enabled` | `includes/class-wpsg-license.php` |
| Server persistence gate | `enforce_license_gates()` | `includes/class-wpsg-layout-templates.php` |
| Config → client | `WPSG_Embed::page_config_js()` `license` block | `includes/class-wpsg-embed.php` |
| Client read | `useWpsgLicense()` | `src/hooks/useWpsgLicense.ts` |
| Client upsell | `showProUpsell()` + `upsell_*` keys | `src/utils/wpsgUpsell.tsx`, `src/i18n-strings.en.json` |
| i18n coverage gate | `check-i18n-locales.mjs` | `scripts/check-i18n-locales.mjs` |
| SDK bootstrap | `wpsg_fs()` | `wp-super-gallery/wp-super-gallery.php` |

Today all three `FEATURE_*` constants collapse to the same coarse `can_use_premium_code()`
check, but keeping them distinct lets a future multi-plan config differentiate features per
tier **without touching any call site**.

---

## 4. The filters

`WPSG_License` (`includes/class-wpsg-license.php`) exposes five filters. With no Freemius
credentials, every one defaults to the **free tier**.

| Filter | Args | Default | Purpose |
|---|---|---|---|
| `wpsg_freemius_config` | `array` | `['id'=>'','public_key'=>'','is_premium'=>false]` | Inject real Freemius credentials (go-live). Empty ⇒ `wpsg_fs()` is a no-op. |
| `wpsg_license_is_pro` | `bool` | `false` | Coarse "any Pro unlocked." Used by the stub path and by tests / local QA (`__return_true`). |
| `wpsg_license_feature_enabled` | `bool $enabled, string $feature` | `can_use_premium_code()` | Per-feature override — flip a single `FEATURE_*` independently (multi-tier). |
| `wpsg_license_tier` | `?string` | `null` | Machine-readable tier label for display. |
| `wpsg_license_upgrade_url` | `string` | `https://your-site.tld/pricing` | Pricing/upgrade URL for upsell CTAs. Set this at go-live (see [MARKETPLACE_READINESS.md](MARKETPLACE_READINESS.md) §3/§5). |

When the Freemius SDK is live (`is_sdk_active()`), `can_use_premium_code()` / `get_tier()`
delegate to Freemius instead of the stubs.

---

## 5. How to add a new Pro feature

The end-to-end pattern, reusing the seams above. Example: gate a hypothetical
"advanced export" feature.

### Step 1 — Declare the feature (server)

Add a constant next to the existing three in `includes/class-wpsg-license.php`:

```php
const FEATURE_LAYOUT_ADVANCED_EXPORT = 'layout_advanced_export';
```

Check it anywhere via `WPSG_License::can_use_feature(WPSG_License::FEATURE_LAYOUT_ADVANCED_EXPORT)`.
By default it collapses to `can_use_premium_code()`; the `wpsg_license_feature_enabled` filter
can flip it independently for a future tier — no call-site changes.

### Step 2 — Gate the client entry point (UX)

Mirror the three existing gates (e.g. `LayoutBuilderLayersPanel.tsx`,
`LayoutBuilderCanvasPanel.tsx`, `LayoutTemplateList.tsx`):

```tsx
import { useWpsgLicense } from '@/hooks/useWpsgLicense';
import { showProUpsell } from '@/utils/wpsgUpsell';

const { isPro, upgradeUrl } = useWpsgLicense();
// …in the click handler:
if (!isPro) {
  showProUpsell('upsell_advanced_export', 'Advanced export is a Pro feature. Upgrade to …', upgradeUrl);
  return;
}
// …licensed path
```

Add the `upsell_advanced_export` key to `src/i18n-strings.en.json` (the shared
`upsell_pro_title` and `upsell_cta` keys already exist).

**Mandatory i18n locale step** (CI gate `i18n:check:locales` / P62-E will fail an English-only
string — see [TRANSLATING.md](TRANSLATING.md)):

```bash
npm run i18n:generate
wp i18n make-pot wp-plugin/wp-super-gallery wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot \
  --domain=wp-super-gallery --exclude=node_modules,vendor,tests,build
# translate the new msgstr in all 5 languages/wp-super-gallery-*.po
wp i18n make-mo  wp-plugin/wp-super-gallery/languages
wp i18n make-php wp-plugin/wp-super-gallery/languages
npm run i18n:check:locales   # must pass
```

### Step 3 — Enforce on the server (only if the feature persists data)

**A client gate alone is bypassable via a direct REST POST.** If the feature saves a field on
the layout template, add a strip/freeze block to `enforce_license_gates()` in
`includes/class-wpsg-layout-templates.php` (it already runs on create, update, and import):

```php
if ( ! WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_ADVANCED_EXPORT ) ) {
    $data['exportConfig'] = $existing === null ? [] : ( $existing['exportConfig'] ?? [] );
}
```

`$existing === null` (create/import) strips to empty; otherwise (update) it freezes to the
last-saved value. A **pure-UI** feature with no persisted field (like the starter library)
needs no server change.

### Step 4 — Expose per-feature state to the client (only if needed)

The client `license` payload currently carries only the coarse `isPro`; per-feature
differentiation lives server-side in `can_use_feature()`. If the new feature needs its **own**
client-visible flag (e.g. it's in a higher tier than the others), extend the `'license'` block
in `WPSG_Embed::page_config_js()` and the `WpsgLicenseInfo` type in `useWpsgLicense.ts`.

### Step 5 — Test it

- **PHP:** license the suite pro by default (`add_filter('wpsg_license_is_pro','__return_true')`
  in `setUp`), then `remove_filter(...)` to go unlicensed and assert the field is
  stripped/frozen. For per-feature cases use a `wpsg_license_feature_enabled` closure. See
  `tests/WPSG_License_Test.php`, `tests/WPSG_Layout_Templates_Test.php`,
  `tests/WPSG_Import_Sanitization_Test.php`.
- **JS:** set `window.__WPSG_CONFIG__.license = { isPro, tier, upgradeUrl }` before render and
  `delete window.__WPSG_CONFIG__` in `afterEach`; assert `showProUpsell` was called with the
  right key. See `src/hooks/useWpsgLicense.test.ts` and the `.test.tsx` beside each gated
  component.

### Checklist for a new Pro feature

- [ ] `FEATURE_*` constant added; call sites use `can_use_feature()`.
- [ ] Client entry point gated with `useWpsgLicense` + `showProUpsell`.
- [ ] Pro UI + its lazy `import()` gated behind `__WPSG_PREMIUM__` so the free WP.org build strips it (see §7).
- [ ] `upsell_*` key added to `i18n-strings.en.json` **and translated in all 5 locales** (`i18n:check:locales` green).
- [ ] If it persists data: `enforce_license_gates()` strip/freeze block added (server enforcement).
- [ ] PHP + JS tests for both licensed and unlicensed branches.

---

## 6. Business decisions (owner)

These are yours to make; they don't change the code (or change it only via a filter):

- **Tier packaging:** today Pro is all-or-nothing (any license unlocks all 3 features). Splitting
  features across tiers is a code-free change via `wpsg_license_feature_enabled`.
- **Expanding the Pro set:** adding features follows §5. The obvious deferred candidate is
  adapter-level gating (currently all free).
- **Pricing:** see [MARKETPLACE_READINESS.md](MARKETPLACE_READINESS.md) §6.

---

## 7. Free vs premium build split — the WP.org "lite" build (P62-F decision)

For the **freemium** distribution (free build on WordPress.org + premium via Freemius), the runtime
`isPro` gate in §3 is **not enough**: WordPress.org forbids shipping locked/premium code, so the
free build must have the Pro code **physically absent**. Freemius's deployment processor can strip
premium *files* (`__premium_only`), but **cannot strip inside our single compiled Vite/React
bundle**. So the front end needs a **build-level** split.

### The mechanism — a build-time flag (`__WPSG_PREMIUM__`)

`vite.config.ts` defines a compile-time constant:

```ts
define: { __WPSG_PREMIUM__: JSON.stringify(process.env.WPSG_PREMIUM !== 'false') },
```

- Default build (`npm run build`, `npm run build:wp`) ⇒ `__WPSG_PREMIUM__ === true` ⇒ the
  **premium** bundle (all Pro code present — identical to today).
- `WPSG_PREMIUM=false` build (`npm run build:free`, `npm run build:wp:free`) ⇒ literal `false` ⇒
  Rollup **dead-code-eliminates** every branch behind the flag, **including the dynamic
  `import()`s** it guards, so the Pro authoring chunks (and their data) never enter the bundle.

The constant is declared ambiently in `src/vite-env.d.ts` (`declare const __WPSG_PREMIUM__:
boolean;`) so TypeScript/ESLint see a normal `boolean` (both branches type-check, no unused-var
noise); only Rollup, seeing the substituted literal, performs the elimination.

### Two orthogonal layers — do not conflate

| Layer | Symbol | Controls | Lives |
|---|---|---|---|
| **Presence** | `__WPSG_PREMIUM__` | whether the Pro code is *in the build* | build time (Vite `define`) |
| **Access** | `isPro` (`useWpsgLicense`) | whether a present feature is *unlocked* | runtime (license) |

Both coexist. The **premium** build keeps the runtime `isPro` check so an expired/trial license
still upsells. The **free** build has the Pro code stripped, so there is nothing to unlock and the
runtime check is moot for those features.

### The gating pattern (as applied to the starter library)

Gate the lazy import, the CTA, and the render so nothing references the Pro chunk when the flag is
false (see `src/components/Admin/LayoutTemplateList.tsx`):

```tsx
const PresetGalleryModal = __WPSG_PREMIUM__
  ? lazy(() => import('./LayoutBuilder/PresetGalleryModal').then((m) => ({ default: m.PresetGalleryModal })))
  : null;
// …CTA button and <PresetGalleryModal/> render both wrapped in `{__WPSG_PREMIUM__ && …}`
```

### Authoring vs rendering — only strip authoring

The public renderer
(`src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`) displays **saved**
text layers and breakpoint overrides and imports **none** of the authoring UI — so the free build
strips the *authoring* code while keeping the *renderer*, preserving the graceful-degradation
guarantee (§2). **P62-G caveat:** two pure renderers used by the public gallery
(`Admin/LayoutBuilder/TextLayerContent.tsx`, `GraphicLayerContent.tsx`) physically live in the
authoring tree and must be **relocated** to a shared module so the stripped free build keeps them.

### Rejected alternatives

- **Lazy-chunk gating alone** (never `import()` the Pro chunk at runtime): leaves the Pro code in
  the bundle — non-compliant — and can't strip *inline* Pro code (text/breakpoint authoring lives
  inside `LayoutBuilder*Panel.tsx`, not in a separate chunk).
- **Separate Vite entries** (`rollupOptions.input`): needs the shared renderer/type/util modules
  hoisted out first anyway, and adds PHP/manifest lookup churn, without solving inline Pro code.

### Deployment consequence (revises the P62-I assumption)

Because Freemius can't strip the JS bundle, the free `.org` build is **self-built**
(`npm run build:wp:free`) and **self-deployed** via the SVN workflow; Freemius receives the premium
(flag-on) build. Freemius JS auto-strip is **not** used. (PHP server code can still use Freemius
`__premium_only` conventions — that's independent of this JS split.)

### i18n note (not a compliance issue)

The English source strings for Pro features (e.g. `lb_preset_desc`, `upsell_starter_library` in
`src/i18n-strings.en.json`) are bundled into the main entry as translation *text* and remain in the
free build regardless of the flag. That is **text, not locked functionality** — WordPress.org
permits upsell/marketing copy — so it is compliant. Stripping Pro i18n keys from the free build's
string manifest is an optional P62-G nicety, not a requirement.

### Status (P62-F, 2026-07-10)

Spike **complete**. Mechanism proven with a kept first slice: the **starter library** is gated
behind `__WPSG_PREMIUM__`. Verified — the free build (`WPSG_PREMIUM=false npm run build`) contains
**no** `PresetGalleryModal-*.js` chunk and **no** preset data (`Magazine Spread` absent), while the
premium build contains both; the premium bundle is byte-size-identical to before. Extending the
pattern to text layers + breakpoint overrides (and the renderer relocation above) is **P62-G**.

---

## 8. Building & deploy-testing the free vs premium editions

Because of the two-layer model (§7), there are **three** states worth deploy-testing — the build flag
decides code *presence*, the license decides *access*:

| State | Build command | License | What you should see |
|---|---|---|---|
| **Free (WP.org "lite")** | `npm run build:wp:free` | n/a | Pro authoring UI is **absent** (no "Add text", no breakpoint switcher, no starter library). Saved Pro content still **renders**. |
| **Premium, unlicensed** | `npm run build:wp` | none | Pro UI is **present but gated** → activating it shows an upsell prompt. (What a buyer sees before activating.) |
| **Premium, licensed** | `npm run build:wp` | fake-pro filter, or real Freemius | Pro features **unlocked**. |

### Build commands

- **Premium build:** `npm run build:wp` — the default build (`__WPSG_PREMIUM__` = true). Runs i18n
  generation + `tsc`/`vite build`, then copies `dist/` into `wp-plugin/wp-super-gallery/assets/`.
- **Free build:** `npm run build:wp:free` — the same pipeline with `WPSG_PREMIUM=false`, so Rollup
  dead-code-eliminates the Pro authoring code.
- **Verify the free build is clean:** `npm run check:free-build` — builds free and fails if any Pro
  chunk/marker leaks in (this is the CI gate).

> Both write to the **same** `wp-plugin/wp-super-gallery/assets/` — the two editions can't coexist
> there. Rebuild to switch, and **reload the browser** afterward (assets are content-hashed and the
> PHP reads the fresh manifest; no plugin re-activation is needed for an asset-only change). The
> **PHP is identical** in both editions — only the JS bundle differs; the server-side
> `enforce_license_gates()` is what keeps the free tier free.

### Simulating a license (no Freemius account needed)

Drop a dev-only must-use plugin to force the licensed state on the **premium** build:

```php
<?php // wp-content/mu-plugins/wpsg-fake-pro.php — DEV/QA ONLY
add_filter( 'wpsg_license_is_pro', '__return_true' );
```

Remove it to see the unlicensed/upsell state. To unlock a single feature (per-tier testing) use the
`wpsg_license_feature_enabled` filter (§4). On the **free** build these filters have no visible
effect — the Pro UI isn't in the bundle to unlock.

### Deploy-testing workflows

- **Quick, one edition at a time (recommended):** `npx wp-env start` loads the plugin straight from
  `wp-plugin/wp-super-gallery/`. Rebuild (`build:wp` / `build:wp:free`), reload, test. Toggle the
  public embed's shadow DOM with `?shadow=0` on the page URL.
- **Both editions side-by-side:** build one, copy `wp-plugin/wp-super-gallery/` to a second folder
  under a distinct slug (e.g. `wp-super-gallery-premium/`), then build the other into the original.
  Install both — this mirrors the real free-slug / `premium_slug` split (M2 in the
  [go-live punch list](GO_LIVE_PUNCH_LIST.md)).
- **Exact release bytes:** the `Release` workflow produces the premium ZIP; the free ZIP comes from
  `build:wp:free` + zipping the plugin folder. For a production-faithful test install those ZIPs on a
  clean site rather than a rebuilt dev tree.
