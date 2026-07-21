# Phase 69 — Manual QA & Validation Runbook

**Companion to:** [PHASE69_REPORT.md](PHASE69_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand — exact preconditions, commands, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test. It follows the format of [PHASE67_MANUAL_QA_RUNBOOK.md](PHASE67_MANUAL_QA_RUNBOOK.md).

**Scope:** tracks P69-A … P69-E. Phase 69 is a **security/privacy hardening & compliance-polish** phase — no exploitable vulnerability was found in the source review; every track either flips a default to the less-invasive choice, documents an existing third-party data flow, or closes a small information-exposure gap. Several tracks are therefore **documentation-only** (P69-A, P69-E) and have no runtime behavior to click through — for those this doc states the *rationale* (why a diff review is the only meaningful check) in place of steps, the same way [PHASE67_MANUAL_QA_RUNBOOK.md](PHASE67_MANUAL_QA_RUNBOOK.md) handles its no-behavior-change tracks.

**Golden rule (unchanged from P63–P67):** a fix's test is only meaningful if you have also seen it **fail without the fix**, or you understand precisely why the pre-fix code was wrong. Each section states the pre-fix behavior so a green result actually proves something. The cleanest way to watch a behavioral track fail is to check out the commit **before** this phase and re-run the same steps:

```bash
git log --oneline | grep -iE 'p69|phase69'   # find the P69 commits
git checkout <commit-before-the-track>        # e.g. the P68 merge commit
# …run a step, observe the pre-fix behavior…
git checkout feature/phase69-react-hardening-2-of-4   # back to the fixes
```

---

## 1. Environment & personas

| Requirement | Why |
|---|---|
| Local `wp-env` dev site (`npx @wordpress/env start` from repo root) | Standard test host. Base URL `http://localhost:8888`. See the `project_phptest_wpenv_env` note: WSL nvm Node 20; use `npx @wordpress/env`, not a global `wp-env`. |
| A **production** front-end build (`npm run build`), served through the shortcode | **Critical for P69-B** — `isWpsgDebugEnabled()` short-circuits to `true` whenever `import.meta.env.DEV` is set, so a dev build always shows debug markers regardless of the PHP default. The default-flip is only observable against a prod build. |
| Browser devtools (Network + Elements panels) | P69-A (font request), P69-B (DOM attributes), P69-C/P69-D (rendered app state). |
| A non-admin (public visitor / logged-out) session **and** an admin session | P69-D's copy differs by viewer; P69-B's markers are on the public path. |

**Personas / auth.** Same RBAC model as Phase 63–68 — see §2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md) for creating a System Admin and a `wpsg_editor`.

---

## 2. Mental model — what actually changed

| Track | The change | Observable? |
|---|---|---|
| P69-A | `docs/PRIVACY.md` now documents the Google Fonts third-party data flow (server-side `<link>` enqueue + client-side injection), its trigger, and the opt-out | No — documentation only. Optionally *observe* the pre-existing flow (a `fonts.googleapis.com` request) to confirm the doc is accurate |
| P69-B | `debug_component_markers` default flipped `true → false` in both `class-wpsg-settings-registry.php` (canonical) and `class-wpsg-embed.php` (defensive fallback) | **Yes** — a fresh install's public gallery no longer stamps `data-wpsg-component` / `data-wpsg-slot` attributes (prod build) |
| P69-C | `parseNodeConfig` in `src/main.tsx` now validates `data-wpsg-config` through a zod schema (allowlist + type-check), matching `parseProps`'s `ALLOWED_PROPS` treatment | **Yes** — a crafted config payload with extra/wrong-typed keys is stripped/coerced instead of passed through |
| P69-D | `ErrorBoundary.tsx` shows generic translated copy to the public; the raw `error.message` only when the viewer is an admin **or** `wpsg_debug` is set. Also adds a public-facing boundary around `<App>` in `main.tsx` (the gallery had none) | **Yes** — a thrown error renders differently for a public visitor vs. an admin/debug session |
| P69-E | `docs/FUTURE_TASKS.md`'s "JWT In-Memory Token Auth" item now cross-references the `wpsg_permissions` cache/TTL gap and no longer claims the provider is commented out | No — documentation only |

---

## 3. Track-by-track

---

### P69-A — Google Fonts data flow documented in PRIVACY.md

**What & why.** When a typography override selects one of the bundled Google fonts, the plugin loads that font from Google's CDN (`fonts.googleapis.com`) on the **public** gallery page — disclosing each visitor's IP to Google. This is the fact pattern behind the 2022 *LG München I* GDPR ruling. `PRIVACY.md` (recently extended for the Freemius flow) previously said nothing about it. P69-A documents the flow in §3 "Data that leaves your server (third parties)".

**This is a documentation-only track — the correct verification is a diff review, not a script.** The code that performs the flow is unchanged; P69-A only makes an existing behavior transparent. There is nothing to make pass or fail at runtime.

**Verification (doc review).** Confirm the new §3 bullet in `docs/PRIVACY.md` accurately states:
- the **trigger** — the flow only happens if the site owner selects a Google font in Settings → Typography (it is *off by default*; the default theme uses no Google font);
- **what is disclosed** — the visitor's IP address and standard request headers, to Google;
- **both mechanisms** — the server-side `wp_enqueue_style` `<link>` (fires even with JS off) *and* the client-side `loadGoogleFont.ts` injection;
- the **opt-out** — use a system font stack, or upload a custom font (served locally via `@font-face`).

**Optional — observe the flow to confirm the doc is accurate (does not change anything).** On a dev site, select a Google font (e.g. Roboto) for a typography override, view a **public** gallery page, and watch the Network panel:

```
DevTools → Network → filter "fonts.googleapis.com"
→ a request to https://fonts.googleapis.com/css2?family=Roboto:… is present.
Then switch the typography override to a system font (or remove it) and reload
→ no fonts.googleapis.com request. (Confirms the "off unless you opt in" claim.)
```

**Why it proves the fix.** The doc's claims (trigger, disclosure, opt-out) are only useful if they match reality; the Network observation confirms the request fires exactly when the doc says it does, and *not* when a system font is used.

**Regression checks.** None — no code changed. The existing `loadGoogleFont.test.ts` and `WPSG_Settings_Typography` coverage remain green because they were not touched.

**Pitfall.** Do not "verify" this by grepping the *summary* one-liner at the top of `PRIVACY.md` — that line is scoped to "sends nothing to *us or any analytics service*," and Google Fonts is a third-party CDN, not us/analytics. The correct home (and the only place the flow is documented, matching how oEmbed/Sentry/webhooks are handled) is §3.

---

### P69-B — Debug component markers default OFF

**What & why.** `debug_component_markers` defaulted to `true`, so every production install stamped `data-wpsg-component` / `data-wpsg-slot` attributes onto every tile, row, and panel of every public gallery — payload and DOM-size overhead for a debugging aid nobody opted into. P69-B flips the default to `false` in **both** places it was hardcoded:
- `class-wpsg-settings-registry.php:30` — the canonical `self::$defaults` array.
- `class-wpsg-embed.php` `page_config_js()` — a defensive `isset(...) ? ... : true` fallback that only fires if `WPSG_Settings` fails to load at all (since `get_settings()` always merges the registry default). Flipped to `false` for consistency so no code path still answers "true".

The admin toggle (Settings → Advanced) and the `wpsg_debug_component_markers` filter remain the explicit opt-in. The `WPSG_DEBUG_COMPONENT_MARKERS` constant override is untouched (intentional dev/test escape hatch).

**Pre-fix behavior.** A fresh install with no settings customization rendered `debugComponentMarkers: true` into `window.__WPSG_CONFIG__`, and every gallery component carried `data-wpsg-*` debug attributes.

**Observable effect: a clean public DOM by default.** This track has a real, user-visible result — but **only in a production build** (see pitfall).

```bash
# 1) Fresh state: ensure no debug_component_markers override is stored.
npx @wordpress/env run cli wp option delete wpsg_settings   # or a fresh install

# 2) Confirm the emitted config now says false:
npx @wordpress/env run cli wp eval '
  $js = WPSG_Embed::page_config_js();
  echo (strpos($js, "\"debugComponentMarkers\":false") !== false ? "OK: false\n" : "FAIL\n");
'
```

Then, with a **production** build served through the shortcode, view a public gallery and inspect the rendered HTML:

```
DevTools → Elements → search for "data-wpsg-component"
→ Pre-fix: present on every tile/row/panel.
→ Post-fix (fresh install, prod build): ABSENT.
```

Toggle the setting back on to confirm the opt-in still works:

```bash
npx @wordpress/env run cli wp eval 'update_option("wpsg_settings", ["debug_component_markers" => true]);'
# Reload the public gallery → data-wpsg-component / data-wpsg-slot reappear.
```

**Why it proves the fix.** Pre-fix, the same fresh-install page carries the debug attributes because the config defaulted them on; post-fix they are gone until an admin explicitly re-enables them — exactly the default-flip's intent. The toggle-on step proves the opt-in path is intact (i.e. the fix removed the *default*, not the *capability*).

**Regression checks.**
- **New:** `WPSG_Settings_Extended_Test::test_get_defaults_debug_component_markers_is_false` asserts `get_defaults()['debug_component_markers'] === false`. (No prior test locked in this default — see PHASE69_REPORT.md Planning Refinement Pass #2.)
- **Unchanged:** `WPSG_Embed_Test::test_render_shortcode_reflects_debug_component_markers_setting` (sets it to `false`, asserts `"debugComponentMarkers":false`), `WPSG_Settings_Test::test_sanitize_settings_persists_false_for_classic_checkbox_hidden_inputs`, and `WPSG_Settings_Rest_Test` all pass unmodified — none asserted the default was `true`.

**Pitfall.** `isWpsgDebugEnabled()` (`src/utils/wpsgDebug.ts`) is `enabled ?? (import.meta.env.DEV || (window.__WPSG_CONFIG__?.debugComponentMarkers ?? false))` — it forces markers **on in any dev build** regardless of the PHP default. If you validate against `npm run dev` you will *always* see the attributes and wrongly conclude the fix failed. Test against `npm run build` output only.

---

### P69-E — JWT permissions-cache gap cross-referenced (tracking only)

**What & why.** `WpJwtProvider.getPermissions()` returns the cached `wpsg_permissions` `localStorage` entry with no TTL — cleared only on logout — so a revoked grant lingers in the client UI until logout (display-only; the server still enforces). The provider is opt-in (`WPSG_ENABLE_JWT_AUTH`, off by default), so this is not scheduled implementation work this phase. P69-E's only action is a documentation edit: `docs/FUTURE_TASKS.md`'s "JWT In-Memory Token Auth" item now cross-references this gap (the prior record, `REACT_REVIEW_FINDINGS.md`, has been archived), and the stale claim that the provider is "commented out" is corrected (it is live, flag-gated `.ts` code).

**This is a documentation-only track with no observable runtime surface — and that is correct.** No code changed; the JWT provider is disabled by default and the staleness is display-only. Following the P67-J pattern for zero-surface tracks, the meaningful check is a **diff review**, not a script:

**Verification (doc review).** In `docs/FUTURE_TASKS.md`'s "JWT In-Memory Token Auth" section, confirm:
- a bullet now describes the `wpsg_permissions` no-TTL cache staleness and points back to PHASE69_REPORT.md § P69-E;
- the text no longer says `WpJwtProvider.tsx` is "currently commented out" — it correctly names `WpJwtProvider.ts` as live, flag-gated code (`getAuthProvider()` in `src/App.tsx` instantiates it only when `enableJwt === true`).

**Why it proves the fix.** The whole point of P69-E is that the eventual JWT rework doesn't miss this gap; the only way that fails is if the cross-reference is absent or inaccurate, which the diff review catches.

**Regression checks.** None — documentation only.

---

### P69-C — `parseNodeConfig` allowlist + type-check

**What & why.** At mount, PHP stamps two attributes onto each host: `data-wpsg-props` and `data-wpsg-config`. `parseProps` filtered `data-wpsg-props` through the `ALLOWED_PROPS` allowlist, but `parseNodeConfig` cast `data-wpsg-config` to `NodeConfig` via a bare `as NodeConfig` assertion — a compile-time-only claim with **no runtime allowlist or type-check**. The attribute is PHP-generated today (low risk), but the asymmetry is the kind that erodes: anything else that can set that attribute (a page-builder plugin storing raw HTML, an XSS elsewhere) got arbitrary keys/types into the mount config. P69-C gives `data-wpsg-config` the same treatment via a small zod schema (mirroring the idioms already in `src/types/settingsSchemas.ts`). The parsing was extracted into `src/mountConfig.ts` so it can be unit-tested without importing `main.tsx`'s side effects.

**Pre-fix behavior.** `parseNodeConfig` returned `JSON.parse(raw) as NodeConfig` — any keys/types in the JSON passed straight through into the React tree.

**Observable effect: malformed config is stripped/coerced.** This is primarily proven by the unit test; the live effect is only visible if you deliberately craft a bad `data-wpsg-config`.

**Verification (unit test — the primary proof).**

```bash
npx vitest run src/mountConfig.test.ts
```

The test feeds `parseNodeConfig` (a) a payload with an extra unexpected key (asserts it is stripped) and (b) a payload with wrong-typed known keys, e.g. `spaceId: "not-a-number"`, `enableLightbox: "yes"` (asserts each is dropped while valid siblings survive), plus the happy path (a legitimate PHP payload passes through unchanged) and the guards (missing attr / invalid JSON / array / null → `{}`).

**Optional live check.** In the browser, on a mounted gallery host, hand-edit the attribute and re-mount (or set it before load):

```js
// DevTools console, on a page with a WPSG mount host:
const host = document.querySelector('[data-wpsg-config]');
host.setAttribute('data-wpsg-config', JSON.stringify({ spaceId: 3, evil: 'x', theme: 42 }));
// Re-mount (reload). The app receives { spaceId: 3 } — 'evil' stripped, wrong-typed 'theme' dropped.
```

**Why it proves the fix.** Pre-fix, `evil` and the numeric `theme` would flow into the component tree verbatim; post-fix the schema strips the unknown key and drops the wrong-typed one, so only allowlisted, correctly-typed fields reach the app — matching `parseProps`'s guarantee for `data-wpsg-props`.

**Regression checks.**
- **New:** `src/mountConfig.test.ts` (parseNodeConfig allowlist/coercion + a couple of `parseProps` cases to confirm the extraction preserved it).
- **Unchanged:** the PHP side that *generates* `data-wpsg-config` is untouched, and `WPSG_Embed_Test`'s `data-wpsg-config` shape assertions remain green — legitimate PHP payloads (numeric `spaceId`, string `theme`, boolean toggles) all satisfy the schema, so there is no behavior change for real traffic.

**Pitfall.** The schema drops a wrong-typed *known* key (falls back to the downstream default) rather than throwing — a single bad field must not discard the whole config. If you "tighten" it to a strict parse that rejects the entire object on one bad field, a malformed page-builder attribute would blank the whole mount. Keep the per-field `.catch(undefined)` + prune approach.

---

### P69-D — ErrorBoundary hides raw error message from the public

**What & why.** `ErrorBoundary`'s default fallback rendered `this.state.error?.message` to whoever was looking. Exception messages can carry internal details (URLs, state fragments); Sentry already receives the full error, so end users don't need it. P69-D shows generic translated copy by default and the raw message only when the viewer is an admin/editor (`isAdmin` prop) **or** the `wpsg_debug` localStorage flag is set. It also adds a **public-facing boundary** around the whole gallery (`<ErrorBoundary>` wrapping `<App>` in `ThemedApp`, `src/main.tsx`) — previously the public listing/viewer had *no* boundary at all, so an uncaught render error was unhandled. The admin sub-trees keep their own inner boundaries that pass `isAdmin` so operators still see raw messages.

**Pre-fix behavior.** Any error boundary (all admin-only before this phase) showed the raw `error.message`. The public gallery path had no boundary, so a render error there produced React's default blank/unmount, not a friendly fallback.

**Note on the "5 sites."** Four boundary call sites use the default fallback and now pass an `isAdmin` value: `src/App.tsx` (×2, real `isAdmin` from `useAuth()`), `src/components/Admin/AdminPanel.tsx` (×2, `isAdmin={true}` — that panel only mounts for editor-or-above). The fifth, `LayoutBuilderModal.tsx`, supplies a **custom `fallback`** prop, so it never reaches the raw-message code and is intentionally left unchanged. The new public boundary in `main.tsx` passes **no** `isAdmin`, so it defaults to generic copy.

**Observable effect: copy differs by viewer.**

**Verification (unit test — the primary proof).**

```bash
npx vitest run src/components/ErrorBoundary.test.tsx
```

Covers: public viewer (no `isAdmin`, no debug) sees generic copy and **not** the raw message; admin viewer (`isAdmin`) sees the raw message; `wpsg_debug=1` reveals the raw message even for a non-admin.

**Manual check.**
- **As a public visitor / non-admin:** trigger a component error (e.g. temporarily throw in a gallery component, or corrupt a payload). The boundary shows *"Something went wrong"* + *"An unexpected error occurred while loading this component."* — **not** the raw message.
- **As an admin**, or with `localStorage.setItem('wpsg_debug', '1')` then reload: the same error now shows the raw `error.message` for troubleshooting.

**Why it proves the fix.** Pre-fix, the raw message rendered for everyone; post-fix a public visitor gets only generic copy (internal details withheld) while privileged operators and debug sessions retain the full message. The full error still reaches Sentry via `componentDidCatch` either way.

**Regression checks.**
- **New/updated:** `src/components/ErrorBoundary.test.tsx` — the two pre-existing tests that asserted the raw message is always shown were updated to the gated behavior (public = generic; admin/debug = raw), and new cases added.
- **Unchanged:** the "Try Again" / `onReset` / custom-fallback / renders-children tests are unaffected by message gating. The empty-message case (`new Error()`) still shows generic copy in all modes (`error.message || genericBody`).

**Pitfall.** `ErrorBoundary` is a class component and cannot call `useAuth()`; `isAdmin` must be threaded as a **prop** from a site that has it. The public `main.tsx` boundary sits *above* the auth context, so it deliberately has no `isAdmin` — that is correct (a public-level boundary should default to hiding details), not a missed wiring.

---

## 4. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P69-A | `PRIVACY.md` §3 accurately documents the Google Fonts trigger / IP disclosure / opt-out; optional Network check confirms the request fires only when a Google font is selected | No code changed — `loadGoogleFont.test.ts` + typography coverage green | ☐ |
| P69-B | Fresh-install **prod build** public gallery has no `data-wpsg-*` attributes; toggling the setting on restores them; emitted config is `debugComponentMarkers:false` | `WPSG_Settings_Extended_Test` new default test + `WPSG_Embed_Test` / `WPSG_Settings_Rest_Test` green | ☐ |
| P69-C | Crafted `data-wpsg-config` with extra/wrong-typed keys is stripped/dropped; legitimate PHP payloads unchanged | `WPSG_Embed_Test` config-shape assertions green; new `src/mountConfig.test.ts` green | ☐ |
| P69-D | Public/non-admin visitor sees generic copy on an error boundary; admin or `wpsg_debug` session sees the raw message; public gallery now has a boundary | Updated `ErrorBoundary` unit tests (public/admin/debug) green | ☐ |
| P69-E | `FUTURE_TASKS.md` cross-references the `wpsg_permissions` TTL gap and no longer claims the provider is commented out | None — documentation only | ☐ |

**Automated baseline (must be green alongside manual QA):** full wp-env PHPUnit suite (Phase 69 adds one PHP test for P69-B) and the front-end Vitest suite (Phase 69 adds parseNodeConfig + ErrorBoundary unit tests for P69-C/P69-D). See PHASE69_REPORT.md → each track's *Implementation* block for per-track rationale and the Planning Refinement Pass for the corrections surfaced during validation.
