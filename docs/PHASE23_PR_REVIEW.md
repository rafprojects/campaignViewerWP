# Phase 23 Implementation Review

**Scope:** Settings architecture refactor, responsive gallery config, campaign parity  
**Review date:** March 30, 2026  
**Review method:** Full source audit of PHP backend (settings, REST, sanitizer) and React frontend (types, resolver, render plan, editor, campaign flow)

---

## Summary

Phase 23 introduces a well-structured nested gallery configuration model alongside the existing flat settings, with shared editing surfaces for global and campaign contexts. The PHP↔React field parity is complete and correct across all 80+ nested fields. The resolver chain, render plan, campaign override round-trip, and sanitization pipeline are solid fundamentally.

This review surfaces issues in three tiers: confirmed bugs that will cause real user-facing problems, security/integrity concerns that should be hardened, and architectural threads that should be addressed before the next phase.

---

## Table of Contents

1. [Detected Issues (Impact Order)](#1-detected-issues-impact-order)
2. [Potential Issues and Warnings](#2-potential-issues-and-warnings)
3. [Threads Outside Immediate Scope](#3-threads-outside-immediate-scope)
4. [Suspicious Threads Not Fully Followed](#4-suspicious-threads-not-fully-followed)
5. [Other Items for Attention](#5-other-items-for-attention)

---

## 1. Detected Issues (Impact Order)

### 1.1 — Per-Breakpoint Adapter Settings Lost on Save (DATA LOSS)

**Severity:** HIGH — silent data loss in a core user workflow  
**Files:**
- `src/utils/galleryConfig.ts` — `collectGalleryAdapterSettingValues()` (line 294)
- `src/components/Admin/SettingsPanel.tsx` — `handleGalleryConfigEditorSave()` (line 252)

**Problem:** When the responsive gallery config editor saves, `collectGalleryAdapterSettingValues()` iterates all breakpoints and scopes but stores only the **first encountered value** for each adapter setting key (`if (collected[typedKey] === undefined)`). If a user sets `carouselVisibleCards = 3` on desktop and `carouselVisibleCards = 5` on tablet inside the responsive editor, only `3` survives the save because desktop is iterated first.

The nested `galleryConfig` object itself stores the per-breakpoint values correctly and is sent to the backend. But the flat mirror fields written in `handleGalleryConfigEditorSave()` (used by inline settings UI) are collapsed to a single value. This means:

1. A save→reopen cycle does not lose data in the nested model itself.
2. But the flat settings surface becomes stale after any per-breakpoint customization.
3. If the user then edits a flat inline field, that edit is sent alongside the (correct) nested config, and both are stored. The flat field becomes a drift source.

**Fix approach:**
- Accept that flat adapter settings are inherently breakpoint-agnostic. Document this limitation clearly.
- Prefer desktop values explicitly in `collectGalleryAdapterSettingValues()` (iterate desktop first is already the case but should be declared as the contract).
- If per-breakpoint adapter settings are important for inline display, add a `representativeBreakpoint` context to the inline sections.

**Verification:** Write a test that saves a galleryConfig with different adapter settings per breakpoint, then calls `collectGalleryAdapterSettingValues()` and asserts which value wins.

---

### 1.2 — Flat + Nested Settings Drift on Save (INTEGRITY)

**Severity:** HIGH — two sources of truth stored together, no reconciliation  
**Files:**
- `wp-plugin/.../class-wpsg-rest.php` — `update_settings()` handler
- `wp-plugin/.../class-wpsg-settings.php` — `sanitize_settings()`
- `src/components/Admin/SettingsPanel.tsx` — `handleGalleryConfigEditorSave()` (lines 252–349)

**Problem:** The save handler sends BOTH flat fields (`imageViewportHeight: 450`) AND the nested `galleryConfig` object to the backend. PHP stores both in the same `wpsg_settings` option via `array_merge()`. There is no backend reconciliation — if a flat field says `image_viewport_height = 450` and `gallery_config.breakpoints.desktop.image.adapterSettings.imageViewportHeight = 500`, both values persist side by side.

The frontend resolver does handle this correctly at read time (nested config wins over flat via the merge chain in `resolveGalleryCommonSettings` and `resolveEffectiveGallerySettings`). But:

1. Editing an inline flat field writes to flat keys only, not to the nested config.
2. The nested config retains its old value.
3. On next read, the nested config wins, silently ignoring the inline edit.

This means **inline setting edits for any field that also exists in the nested config can be silently dropped** after the responsive editor has been used at least once.

**Fix approach:**
- When inline settings change a field that maps to a nested config key, also update the corresponding nested path in `galleryConfig` before save.
- Or: add a `syncFlatToNested()` call in the save pipeline.
- Or: on inline field edit, clear the corresponding nested config entry so the flat field becomes authoritative again.

**Verification:** Test sequence: open responsive editor → save → edit an inline field that maps to a nested key (e.g., `adapterItemGap`) → save → reload → verify the inline edit persisted.

---

### 1.3 — Unified Mode Uses Wrong Legacy Fallback Adapter (BUG)

**Severity:** MEDIUM — incorrect adapter selection in specific scenario  
**Files:**
- `src/utils/campaignGalleryRenderPlan.ts` — `resolveUnifiedCampaignGalleryRenderPlan()` (line 110)

**Problem:** The unified render plan passes `campaign.imageAdapterId` as the `legacyOverrideId` in the resolution chain:

```ts
resolveUnifiedAdapterId(settings, breakpoint, {
  galleryOverrides: campaign.galleryOverrides,
  legacyOverrideId: campaign.imageAdapterId,  // ← semantic mismatch
})
```

`imageAdapterId` is a per-type mode concept. In unified mode, if a campaign previously had `imageAdapterId: 'masonry'` set (for per-type viewing) and the admin later switches the global mode to unified, the unified gallery will use `'masonry'` as a fallback — which was never the user's intent for unified presentation.

**Fix:** Pass `undefined` instead of `campaign.imageAdapterId`, or check whether the campaign has an explicit unified adapter override before falling back.

**Verification:** Create a campaign with `imageAdapterId: 'masonry'` and no `galleryOverrides`. Switch global mode to unified with `unifiedGalleryAdapterId: 'compact-grid'`. Verify the campaign uses `'compact-grid'` (global config), not `'masonry'` (legacy image fallback).

---

### 1.4 — Type Confusion in Nested URL Sanitization (SECURITY)

**Severity:** MEDIUM — non-exploitable but incorrect storage  
**Files:**
- `wp-plugin/.../settings/class-wpsg-settings-sanitizer.php` — `sanitize_nested_gallery_setting()` (line 811)

**Problem:** URL fields in nested gallery config are sanitized with `esc_url_raw((string) $value)`. If the frontend sends a non-string value (object or array) for a URL field, the `(string)` cast produces the literal string `"Array"` or `"Object"`, which `esc_url_raw()` returns as-is (it adds a scheme prefix or returns empty, depending on the version). The stored value is corrupted.

**Impact:** Low exploitability because:
1. The frontend constructs these values from form inputs (always strings).
2. The stored values are rendered as CSS `background-image` URLs, not as HTML, limiting injection surface.
3. WordPress `esc_url_raw()` will either return empty string or something benign.

But a crafted API payload could pollute stored data.

**Fix:** Add `if (!is_string($value)) return ['accepted' => false];` before the URL sanitization line.

**Affected fields:** `viewportBgImageUrl` in all nested scopes (unified/image/video × desktop/tablet/mobile).

---

### 1.5 — Gradient Stop Color Not Validated (SECURITY)

**Severity:** LOW-MEDIUM — limited impact in current architecture  
**Files:**
- `wp-plugin/.../settings/class-wpsg-settings-sanitizer.php` — `sanitize_viewer_bg_gradient()` (line 1124)

**Problem:** Gradient stop colors use `sanitize_text_field()` which only strips HTML tags. It does not validate CSS color format. This allows arbitrary text to be stored as a "color":
- `"anything-here"` would pass
- `"rgb(0,0,0); --injected: value"` would pass (though `sanitize_text_field` strips newlines, limiting multi-line injection)

**Impact:** The gradient is applied as a CSS string on the frontend via inline styles. Modern React/JSX CSS injection is limited because React escapes values in style objects. If the gradient string is assembled into a raw CSS string anywhere, there could be a vector.

**Fix:** Add strict color format validation:
```php
if (!preg_match('/^(#[0-9a-fA-F]{3,8}|rgba?\([0-9,.\s%]+\)|hsla?\([0-9,.\s%deg]+\)|[a-z]{3,20})$/i', $color)) {
    continue;
}
```

---

### 1.6 — Unified Border Radius Uses Inconsistent Source (UX BUG)

**Severity:** LOW — visual inconsistency, not data corruption  
**Files:**
- `src/utils/campaignGalleryRenderPlan.ts` — `buildWrapperPlan()` (line ~19)

**Problem:** For unified scope, the wrapper border radius is calculated as `Math.max(settings.imageBorderRadius ?? 0, settings.videoBorderRadius ?? 0)`. This borrows from per-type fields rather than using a unified-specific value or the nested config's own border radius.

**Fix:** Either add a `unifiedBorderRadius` common setting, or use the resolved adapter settings' border radius from the active scope config.

---

## 2. Potential Issues and Warnings

### 2.1 — Campaign Adapter Quick Selectors Show Blank for Per-Breakpoint Overrides

**Files:**
- `src/utils/campaignGalleryOverrides.ts` — `getUniformCampaignScopeAdapterId()` (~line 108)

**Problem:** The campaign edit UI shows inline adapter selectors. These call `getUniformCampaignScopeAdapterId()` which returns empty string if breakpoints have different adapter IDs. The quick selectors will appear blank/unset even though per-breakpoint overrides are active.

**Impact:** UX confusion only — the overrides still work at render time. But admins may think their per-breakpoint work was lost.

**Recommendation:** Show a "Mixed" indicator in the quick selector when breakpoints differ, or show the desktop value with a breakpoint indicator badge.

---

### 2.2 — No Frontend Test Coverage for Resolver Fallback Chain or Settings Bridge

**Files:**
- `src/utils/resolveAdapterId.test.ts` — exists but limited scenarios
- `src/utils/galleryConfig.ts` — no dedicated test file found

**Missing test coverage:**
- `collectGalleryAdapterSettingValues()` — not tested at all
- Flat-to-nested bridge round-trip with conflicting values
- `resolveEffectiveGallerySettings()` with both legacy and modern inputs present
- `mergeGalleryConfig()` edge cases (partial breakpoints, empty scopes)
- Settings save→reload cycle with both flat and nested fields

**Recommendation:** Add a `galleryConfig.test.ts` file covering:
1. `collectGalleryAdapterSettingValues` first-value-wins behavior
2. `buildGalleryConfigFromLegacySettings` then `collectGalleryAdapterSettingValues` round-trip
3. `mergeGalleryConfig` partial override application
4. Edge case: empty/null breakpoints in merge

---

### 2.3 — `getRepresentativeGalleryCommonSetting` Cascades Across Breakpoints

**Files:**
- `src/components/Admin/SettingsPanel.tsx` — `handleGalleryConfigEditorSave()` (lines 265+)

**Problem:** The function reads from desktop first, then tablet, then mobile, and returns the first defined value. If the user only set a common setting at the tablet breakpoint (leaving desktop at default), the representative value comes from tablet. This is generally fine, but means the inline UI could show values from unexpected breakpoints without indicating which breakpoint they came from.

**Recommendation:** Consider always using desktop as the canonical representative, or displaying a breakpoint source indicator.

---

### 2.4 — WPSG_ALLOW_NONCE_BYPASS Relies on Environment Markers

**Files:**
- `wp-plugin/.../class-wpsg-rest.php` — `verify_admin_auth()` (~line 737)

**Problem:** The nonce bypass requires both `WPSG_ALLOW_NONCE_BYPASS` to be defined AND either `WP_DEBUG` or `WP_TESTS_DOMAIN` to be true. While this is safe in practice, `WP_DEBUG` being true in a staging environment where the constant was accidentally defined would open nonce bypass.

**Recommendation:** Log a critical warning if the bypass fires outside `WP_TESTS_DOMAIN` (currently only logs a generic warning). Consider restricting to `WP_TESTS_DOMAIN` only.

---

### 2.5 — Campaign Scheduling Enforcement Is Query-Time Only

**Files:**
- `wp-plugin/.../class-wpsg-rest.php` — `list_campaigns()`

**Problem:** Campaigns with `publish_at` set to a future date are still stored in the database immediately. Scheduling is enforced at query time via meta_query filters. If any code path queries campaigns directly (not through `list_campaigns()`), scheduled campaigns could leak.

**Recommendation:** Audit all campaign query paths to confirm they all use the scheduling meta_query filter.

---

## 3. Threads Outside Immediate Scope

### 3.1 — Rate Limiting Not Applied to User Creation Endpoint

**Files:**
- `wp-plugin/.../class-wpsg-rest.php` — `POST /users` route registration

**Problem:** The user creation endpoint uses `require_admin` as its permission callback but does not apply `rate_limit_authenticated`. A compromised admin account could create thousands of users rapidly.

**Fix:** Change permission callback to `rate_limit_authenticated` (which already calls admin capability checks internally).

---

### 3.2 — Responsive Editor Does Not Sync With Inline Settings in Real Time

**Problem:** When the responsive GalleryConfigEditorModal is open, any changes made in the inline settings sections underneath are not reflected in the modal's state. Similarly, modal changes don't update the inline preview until the modal is closed and saved. This is expected behavior for a modal editing pattern, but if the user makes changes in both places during one session, the modal save will overwrite the inline changes.

**Recommendation:** Disable inline settings editing while the responsive editor modal is open, or add a visual indicator that inline changes will be overwritten on modal save.

---

### 3.3 — Adapter Settings Flat↔Nested Asymmetry Is Structural

The core asymmetry is that flat settings (200+ fields in one object) are breakpoint-agnostic, while nested gallery config supports per-breakpoint values. This creates an inherent impedance mismatch in the bridge layer. Phase 23 made the right call to keep both during transition, but the bridge logic in `SettingsPanel.handleGalleryConfigEditorSave()` is now 100+ lines of manual field extraction.

**Recommendation for next phase:** Either:
- Accept flat fields as the canonical source and treat nested config as the responsive layer only, or
- Migrate completely to nested config and deprecate flat adapter/common fields

Maintaining both long-term will accumulate integration bugs (see 1.1 and 1.2 above).

---

### 3.4 — PHP Color Fields Use `sanitize_text_field` Instead of Color Validation

Multiple color fields throughout the sanitizer pipeline (not just gradients) use `sanitize_text_field()` instead of `sanitize_hex_color()` or a regex validator. While the main settings sanitizer handles some color fields with specific validation, the nested gallery config's common and adapter settings fall through to the generic `sanitize_text_field()` handler for all string-typed fields.

**Affected fields:** `navArrowColor`, `navArrowBgColor`, `dotNavActiveColor`, `dotNavInactiveColor`, `tileBorderColor`, `tileGlowColor`, `viewportBgColor` — when processed through the nested config path.

**Recommendation:** Add CSS color format validation in `sanitize_nested_gallery_setting()` for fields known to be colors (identifiable by field name pattern matching `_color` suffix).

---

## 4. Suspicious Threads Not Fully Followed

### 4.1 — `adapterSettings` Is `Record<string, unknown>` — Unbounded Keys

The TypeScript type `GalleryScopeConfig.adapterSettings` is typed as `Record<string, unknown>`. While the PHP sanitizer strips unknown keys against the `nested_adapter_field_map`, the frontend does not validate outgoing adapter settings against a whitelist before sending. A modified frontend could send arbitrary keys in `adapterSettings` — the PHP sanitizer will strip them, but the generic `sanitize_gallery_config_value()` fallback handler may still accept some. This path was partially audited; the generic handler applies `sanitize_text_field()`, `intval()`, or `floatval()` based on value type, but does not reject unknown keys outright.

**Risk:** Low — the accepted values are sanitized, just stored unnecessarily. But could pollute the DB option with unexpected keys over time.

**Recommendation:** Verify that `sanitize_gallery_scope()` in PHP explicitly strips keys not in the field maps, rather than falling through to generic handling.

---

### 4.2 — Legacy Campaign Adapter Overrides and Mode Mismatch

When the global mode changes (e.g., from per-type to unified), existing campaigns with `imageAdapterId` or `videoAdapterId` set may exhibit unexpected behavior. The resolver chain attempts legacy fallback, but the semantic meaning of `imageAdapterId` changes depending on whether the global mode is unified or per-type. This was flagged in 1.3 above for the unified case; the broader concern is whether all campaigns should have their legacy adapter fields cleared when the global mode changes — which is outside the Phase 23 scope but could create user confusion.

---

### 4.3 — `parseGalleryConfig` Error Handling

The frontend parses `galleryConfig` from the API response. If the response includes a malformed JSON string or an unexpected type, `parseGalleryConfig()` returns `undefined` and the legacy bridge kicks in. This is safe, but there is no error logging or user notification. A corrupted database entry would silently revert to legacy behavior without any admin indication.

---

### 4.4 — `masonry_auto_column_breakpoints` Field Type

This field's default and expected type on the PHP side should be verified. The name suggests it might be an array or string of breakpoint values, but it's mapped through the adapter settings field map as a single key. If the frontend sends an array and PHP expects a scalar (or vice versa), the `sanitize_nested_gallery_setting()` handler will coerce it to a string via `sanitize_text_field()`, which would produce `"Array"`.

---

## 5. Other Items for Attention

### 5.1 — PHP↔React Field Parity Is Currently Complete

All 20 base common settings, 4 scope-aware viewport background fields, and 60 adapter settings fields are consistently mapped between `WPSG_Settings_Sanitizer::$nested_common_field_map` / `$nested_adapter_field_map` (PHP) and `COMMON_SETTING_FIELD_MAP` / adapter registry setting groups (React). Adding a new field to one side without the other will silently drop or ignore it.

**Recommendation:** Add a shared reference (even a comment) listing the field count in both files, so future developers can quickly verify parity.

### 5.2 — Campaign Gallery Overrides Round-Trip Is Working

The `_wpsg_gallery_overrides` post meta storage, `sanitize_gallery_overrides()`, and the campaign REST response all handle the nested config correctly. PHP round-trip tests exist in `WPSG_Campaign_Rest_Test.php` (`test_campaign_gallery_overrides_round_trip` and `test_campaign_gallery_overrides_round_trip_from_json_body`).

### 5.3 — SSRF Protection Is Well-Implemented

The oEmbed proxy endpoint has comprehensive SSRF defenses including HTTPS enforcement, hostname allowlist, private IP filtering for both IPv4 and IPv6, and DNS rebinding protection. This is one of the strongest parts of the security posture.

### 5.4 — Rate Limiter IP Detection Is Secure

The rate limiter correctly requires `REMOTE_ADDR` to be in a trusted proxy list before honoring `X-Forwarded-For` headers, preventing IP spoofing. Tests cover the key scenarios.

### 5.5 — Bearer Token Auth Is Correctly Two-Phase

Initial analysis flagged the nonce bypass for Bearer tokens as a potential vulnerability. On deeper investigation, this is correctly implemented: the JWT auth plugin validates the token via WordPress's `determine_current_user` filter before the permission callback runs. By the time `require_admin()` executes, `current_user_can('manage_wpsg')` has already been set by the validated token. The nonce skip is appropriate because nonces are a CSRF protection mechanism and are not needed for token-based auth.

---

## Action Priority

| # | Issue | Severity | Effort | Section |
|---|-------|----------|--------|---------|
| 1 | Flat↔nested settings drift on inline edit + save | HIGH | Medium | 1.2 |
| 2 | Per-breakpoint adapter settings collapse | HIGH | Low-Medium | 1.1 |
| 3 | Unified mode wrong legacy adapter fallback | MEDIUM | Low | 1.3 |
| 4 | URL type confusion in nested sanitizer | MEDIUM | Low | 1.4 |
| 5 | Gradient color validation | LOW-MED | Low | 1.5 |
| 6 | Missing Vitest coverage for bridge/resolver | MED | Medium | 2.2 |
| 7 | Campaign quick selector blank for mixed | LOW | Low | 2.1 |
| 8 | Rate limit on user creation | LOW | Trivial | 3.1 |
| 9 | Color field validation in nested config | LOW | Low | 3.4 |
| 10 | Flat↔nested long-term strategy decision | ARCH | — | 3.3 |
