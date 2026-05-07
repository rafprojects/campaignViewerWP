# Phase 25 Settings Refactor

## Status

Implementation record updated through 2026-04-30.

Core Phase 25 bridge-removal work is complete for the active gallery settings contract. The remaining follow-up is documentation/reference cleanup and broader schema decomposition that was intentionally not required to finish the contract reset.

### Remaining cleanup triage

As of 2026-04-30, the remaining cleanup is limited to:

1. Sync living reference docs and planning notes that still describe SWR-era internals or the removed flat-field bridge.
2. Clear the TypeScript 6 deprecation warning triggered by the old `baseUrl` compiler option.
3. Leave historical phase reports as point-in-time records instead of rewriting their original state descriptions.
4. Keep broader `GalleryBehaviorSettings` schema decomposition as a separate follow-on, not a blocker for the completed contract reset.

This document promotes the data-model cleanup work that earlier docs deferred and refines the original proposal in `docs/REFACTOR_SETTINGS_ZUSTAND_REACTQUERY_ZOD.md`.

### Progress Notes

- Completed 2026-04-29: initial schema foundation landed in `src/types/settingsSchemas.ts` with focused tests and the first schema-backed parse boundaries in `galleryConfig.ts` and `mergeSettingsWithDefaults.ts`.
- Completed 2026-04-29: settings-only TanStack Query plumbing landed for the root settings fetch path, shared providers, SettingsPanel fallback load/save hooks, and in-context save cache updates.
- Completed 2026-04-29: `SettingsPanel` draft/original/dirty/reset lifecycle moved into a scoped Zustand store in `src/contexts/SettingsStore.ts`, with focused store coverage and no remaining JSON-stringify dirty check in the panel component.
- Completed 2026-04-29: the frontend gallery bridge now round-trips unit-bearing common settings through `galleryConfig`, and the Gallery & Media settings UI now resolves adapter-dependent detail visibility from nested `galleryConfig` instead of stale flat adapter IDs.
- Completed 2026-04-29: the inline Gallery & Media panels now read nested common settings from resolved `galleryConfig`, and migrated viewport background edits plus shared common-setting edits save back through nested `galleryConfig` instead of writing those flat legacy fields directly.
- Completed 2026-04-29: the remaining inline viewer/common controls in Media Display and Campaign Viewer now read and write nested `galleryConfig` directly, and the settings merge/save path no longer mirrors gallery common or scope-background fields back into flat settings state.
- Completed 2026-04-29: the campaign editor flow now keeps only nested `galleryOverrides` in modal state; `useUnifiedCampaignModal` and `UnifiedCampaignModal` no longer derive or store flat `imageAdapterId` / `videoAdapterId` bridge values during edit/save.
- Completed 2026-04-29: campaign render planning now resolves adapters from nested `galleryOverrides` only, and the dedicated `legacyOverrideId` fallback has been removed from `resolveAdapterId()`.
- Completed 2026-04-29: campaign flat adapter ids have been removed from the public frontend campaign types and REST/CLI export payloads.
- Completed 2026-04-30: campaign gallery rendering now carries explicit `ResolvedGallerySectionRuntime` (`runtime.common`, `runtime.background`, and `runtime.adapterSettings`) through render planning and adapter entry points instead of projecting nested values back onto flat runtime fields.
- Completed 2026-04-30: adapter settings are now nested-only end to end. `mergeSettingsWithDefaults()`, `SettingsPanel`, inline Gallery & Media panels, and campaign render planning no longer backfill or depend on flat adapter-setting projection.
- Completed 2026-04-30: PHP `get_settings()` and settings REST responses now omit flat nested-only gallery bridge fields consistently, including adapter settings, and direct flat gallery writes are ignored in favor of nested `galleryConfig`. `galleryConfig` and `galleryOverrides` are the only active gallery contract surfaces exposed to the app.
- Completed 2026-04-30: remaining migration support has been removed from the active contract. Frontend settings hydration no longer reconstructs nested config from flat gallery fields, campaign helpers no longer promote flat adapter ids, and PHP DB/REST/CLI paths no longer backfill nested settings or overrides from legacy storage.
- Completed 2026-04-30: deprecated `ImageCarousel` and `VideoCarousel` wrappers now pass resolved common settings explicitly, and `MediaCarouselInner` no longer derives shared common settings through an internal fallback path.
- Completed 2026-04-30: validation for the completed bridge-removal slice is green across focused Vitest, full Vitest, `npm run build`, focused wp-env settings PHPUnit, and full wp-env PHPUnit.
- Completed 2026-04-30: the broader frontend data layer now uses TanStack Query as well. App campaigns, admin tab resources, layout-template flows, public layout-template loading, and the shared test providers have been migrated off SWR, and the `swr` dependency has been removed.
- Completed 2026-04-30: the remaining live flat-field bridge inside the settings UI and gallery runtime has been removed. Adapter-specific settings now write straight into nested `galleryConfig.adapterSettings`, and common runtime resolution now derives defaults from nested `galleryConfig` instead of rebuilding them from flat gallery fields.
- Completed 2026-05-05: `src/types/settingsSchemas.ts` now validates the known nested `adapterSettings` leaves at the parse boundary while preserving unknown future adapter keys, closing the last broad `Record<string, unknown>` gap between the frontend settings parser and the backend nested gallery sanitizer.
- Commentary: `SettingsPanel` still owns view-local UI state such as tabs, custom-font editor wiring, and the responsive-config modal open state. W5 is complete for draft lifecycle state, and the remaining Phase 25 work is now cleanup/docs rather than bridge removal.

---

## Why This Phase Exists

The current settings system carries two distinct kinds of debt at once:

1. `GalleryBehaviorSettings` has become a catch-all interface for unrelated concerns, making it expensive to reason about and easy to regress.
2. The flat-field compatibility bridge around `galleryConfig` and campaign adapter overrides is still consuming type, runtime, sanitizer, and test surface even though nested config is already canonical on write.

This is now worth addressing directly because the plugin is still pre-release. There is no release-bound requirement to preserve a legacy read path for flat fields that were never part of a shipped stable contract.

---

## Evaluation Of The Existing Proposal

The original proposal identified the right problems, but a few scope decisions needed adjustment.

| Topic | Evaluation | Notes |
|---|---|---|
| Monolithic `GalleryBehaviorSettings` | Accurate | The interface and defaults surface are too large and mix unrelated domains. |
| Legacy flat-to-nested bridge | Accurate | The bridge is real maintenance debt across frontend, PHP, and tests. |
| Manual `SettingsPanel` state | Accurate | Local draft/original/dirty/load/save state is hand-rolled and difficult to test. |
| Direct API calls / no caching | Partially accurate | At the time of the proposal, the app already used SWR broadly, but settings did not have a clean, dedicated query abstraction and relied on manual cache workarounds. That broader layer has now been migrated to TanStack Query as part of the follow-on cleanup slice. |
| Fragile coercion in `mergeSettingsWithDefaults()` | Accurate | JSON parsing and coercion are manual, narrow, and hard to observe or test. |

### Net conclusion

The proposed direction is valid, with these refinements:

1. **Remove the bridge in this phase**, not later. Pre-release status removes the main argument for carrying legacy reads forward.
2. **Include campaign legacy override cleanup in the same phase** so the data model becomes consistently nested-only.
3. **Adopt TanStack Query for settings first**, then extend the same query model through the broader app/admin/layout data layer once the canonical contract cleanup is stable.

---

## Resolved Decisions

| # | Decision | Resolution |
|---|---|---|
| A | Global settings storage model | `galleryConfig` becomes the only supported gallery settings representation. |
| B | Campaign override model | `galleryOverrides` becomes the only supported campaign gallery override representation. |
| C | Legacy read compatibility | Remove it in this phase. No transitional bridge window is required for unreleased installs. |
| D | Runtime validation | Add Zod at the settings boundary and expand from there. |
| E | Query layer scope | Migrate settings to TanStack Query first, then complete the broader SWR retirement slice once the nested-only contract is stable. |
| F | Draft state scope | Use Zustand for settings draft/original/dirty lifecycle after the query boundary is in place. |
| G | Campaign cleanup timing | Bundle campaign legacy adapter cleanup with the global bridge removal. |

---

## Goals

1. Replace the monolithic settings surface with schema-composed domains that are easier to test and evolve.
2. Remove the flat-field bridge from frontend runtime code, PHP response shaping, sanitization, and tests.
3. Move settings boundary parsing and coercion into Zod-backed helpers.
4. Replace ad hoc settings fetching and invalidation with dedicated TanStack Query hooks for the settings surface.
5. Replace `SettingsPanel` local draft/original/dirty state with a focused Zustand store.
6. Align campaign overrides with the same nested-only contract.

---

## Non-Goals

1. Full app-wide SWR to TanStack Query migration in the initial settings-only slice.
2. Large-scale viewer/auth/query/store refactors outside what is required by the settings contract cleanup.
3. Carrying forward flat global gallery fields or flat campaign adapter overrides as a runtime compatibility layer.

---

## Workstreams

### W0. Baseline And Contract Freeze

Define the current contract before deleting code.

Tasks:

1. Enumerate the remaining consumers of `GalleryBehaviorSettings`, `galleryConfig`, `imageAdapterId`, and `videoAdapterId`.
2. Identify every read/write path that still depends on flat bridge hydration.
3. Lock in regression coverage for nested settings load/save, campaign override precedence, adapter resolution, and classic WordPress partial-save behavior.

Deliverables:

1. Updated risk checklist for settings, campaign overrides, and PHP persistence.
2. Focused tests protecting the current canonical nested behavior before bridge removal.

### W1. Schema Foundation

Introduce a schema layer without trying to migrate every field at once.

Tasks:

1. Create `src/types/settingsSchemas.ts`.
2. Start with the nested canonical surface:
   - `TypographyOverrideSchema`
   - `TypographyOverridesSchema`
   - `GalleryCommonSettingsSchema`
   - `GalleryScopeConfigSchema`
   - `BreakpointGalleryConfigSchema`
   - `GalleryConfigSchema`
3. Add safe parse helpers for boundary inputs that currently rely on hand-written parsing.
4. Expand schema coverage toward the broader settings model after the nested core is stable.

Deliverables:

1. Shared Zod schemas for nested gallery config and typography overrides.
2. Unit coverage proving valid/invalid payload handling.

Status update: initial deliverables complete for nested gallery config and typography override parsing. Broader settings-domain decomposition remains follow-on work inside W1.

### W2. Global Legacy Bridge Removal

Delete the flat global gallery bridge and keep only nested config.

Tasks:

1. Remove flat gallery compatibility reads and write-back helpers from the frontend settings pipeline.
2. Remove projection of nested `galleryConfig` back into flat response fields in PHP.
3. Simplify settings registry/sanitizer logic to nested-only gallery settings.
4. Remove or time-box any temporary type aliases used purely to help the migration land.

Primary files:

1. `src/utils/galleryConfig.ts`
2. `src/utils/resolveAdapterId.ts`
3. `src/utils/mergeSettingsWithDefaults.ts`
4. `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-utils.php`
5. `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`
6. `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php`
7. `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`

Status update: W2 is complete for the active settings contract. Frontend load/save/runtime paths no longer backfill flat gallery fields from nested config or reconstruct nested config from flat gallery fields, the inline settings sections read representative common/background/adapter values directly from `galleryConfig`, campaign render planning consumes explicit runtime common/background/adapter settings, and PHP settings/REST shaping now omits flat nested-only gallery fields consistently while direct flat gallery writes are ignored. The remaining registry/sanitizer mappings are now only metadata for nested gallery validation rather than active compatibility behavior.

### W3. Campaign Legacy Override Removal

Bring campaign overrides onto the same nested-only contract.

Tasks:

1. Remove legacy adapter normalization helpers from campaign edit flows.
2. Stop reading/writing flat `imageAdapterId` / `videoAdapterId` override behavior as part of the supported contract.
3. Update PHP campaign meta handling and tests so `galleryOverrides` is the only gallery override representation.

Primary files:

1. `src/utils/campaignGalleryOverrides.ts`
2. `src/hooks/useUnifiedCampaignModal.ts`
3. `src/components/Campaign/UnifiedCampaignModal.tsx`
4. `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
5. `wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php`

Status update: the frontend campaign editor and runtime now treat `galleryOverrides` as the only public campaign override surface. Modal draft state is nested-only, render planning no longer uses a dedicated legacy fallback parameter, and the PHP REST/CLI layer no longer promotes older flat adapter meta or import payloads into nested overrides.

### W4. Settings Query Migration

Adopt TanStack Query starting with settings.

Tasks:

1. Add `QueryClientProvider` to the app root.
2. Create dedicated settings query/mutation hooks.
3. Migrate the root settings fetch path and in-context save workflow away from the SWR settings key.
4. Keep the broader admin and campaign layer stable during the initial settings migration, then remove SWR in a dedicated follow-on slice once the contract reset is green.

Status update: the initial settings slice is complete, and the follow-on broader migration is now complete as well. The root provider, settings query hooks, root settings fetch path, SettingsPanel fallback load/save path, in-context save cache flow, app campaign loading, admin tab resources, layout-template flows, and public layout-template loading are all on TanStack Query. `SettingsPanel` still uses local component state for draft/original/dirty handling, which remains the W5 integration task.

Primary files:

1. `src/main.tsx`
2. `src/App.tsx`
3. `src/services/settingsQuery.ts`
4. `src/hooks/useInContextSave.ts`
5. `src/test/test-utils.tsx`

### W5. Settings Draft Store

Move settings panel draft management into Zustand.

Tasks:

1. Create a focused store for current settings, original settings, dirty state, and reset/save actions.
2. Feed the store from parsed query results.
3. Remove JSON-stringify dirty checks and duplicated local state from `SettingsPanel`.

Status update: tasks 1-3 are complete for the current settings draft lifecycle. `SettingsPanel` now uses a scoped Zustand store for `settings`, `originalSettings`, hydration from query results, dirty tracking, reset, and post-save sync. UI-local view state remains component-local by design.

Primary files:

1. `src/contexts/SettingsStore.ts`
2. `src/components/Admin/SettingsPanel.tsx`

### W6. Consumer Cleanup And Documentation Sync

Update code and docs that still assume the bridge exists.

Tasks:

1. Update tests and fixtures that expect flat gallery bridge hydration.
2. Update architecture docs to describe the bridge as current-state legacy behavior only, not a long-term direction.
3. Keep the implementation docs aligned now that the broader query migration is complete.

Status update: W6 is complete for the live implementation surface. Tests and fixtures covering the active settings contract have been refreshed away from flat gallery bridge expectations, the architecture docs now describe `galleryConfig` / `galleryOverrides` as the active nested-only contract, and the deprecated shared carousel wrappers plus settings UI now operate on nested gallery data directly instead of relying on an internal flat-field bridge.

---

## Regression Matrix

| Risk | Failure Mode | Required Coverage |
|---|---|---|
| Settings REST shape drift | Root app or settings panel still expects flat gallery keys | Frontend settings load/save tests plus PHPUnit REST assertions |
| Campaign override precedence regression | Global nested config overwrites campaign overrides | Campaign render-plan and modal tests |
| Adapter resolution regression | Breakpoint/scope resolution breaks after flat fallback removal | Resolver and gallery config tests |
| Classic WP partial-save regression | `gallery_config` is dropped during classic saves | PHPUnit coverage for partial admin saves |
| Query migration cache race | Explicit settings save and in-context save diverge | Query hook tests plus UI integration tests |
| Type cleanup fallout | Call sites still rely on bridge-populated fields | Typecheck plus updated fixtures across viewer/card/settings tests |

---

## Verification Checklist

1. Unit tests for settings schemas and boundary parse helpers.
2. Frontend tests for nested settings load, edit, save, reset, and in-context save batching.
3. Campaign tests for nested `galleryOverrides` editing, persistence, and precedence over global config.
4. PHPUnit coverage for nested-only settings responses and nested-only campaign override persistence.
5. One end-to-end settings workflow that edits nested gallery settings, saves, reloads, and verifies canonical persistence.
6. Typecheck and test passes after each workstream, not just at the end.

Latest validation: focused adapter-bridge Vitest slice is green at 4 files / 109 tests, full Vitest is green at 97 files / 1318 tests, `npm run build` passes, focused wp-env settings PHPUnit is green at 20 tests / 131 assertions, and the full wp-env PHPUnit suite is green at 527 tests / 1575 assertions.

---

## Follow-On Query Cleanup

Phase 25 intentionally shipped the settings query slice first.

Completed 2026-04-30: the follow-on cleanup pass migrated the broader app/admin/layout data layer to TanStack Query as well, retired the temporary `useAdminSWR.ts` compatibility surface, and removed the `swr` dependency from the active frontend runtime and shared test harness.

---

## Open Questions

No blocking product decisions remain for this phase. Tactical implementation choices can be resolved during the work as long as they preserve the resolved decisions above.