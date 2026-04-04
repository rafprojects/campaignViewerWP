# P25-X Phases 5-8 Deep Implementation Plan

**Track:** P25-X  
**Title:** Multi-unit CSS dimension support + card breakpoint overrides  
**Author:** GPT-5.4  
**Date:** 2026-04-03  
**Scope:** phases 5 through 8 only  
**Precondition:** Apply the phase 1-4 corrections from `P25X_GPT54_IMPLEMENTATION_REVIEW.md` before implementation starts.

---

## Summary

Phases 5-8 are implementable, but the current planning text leaves several important behaviors underspecified. The risky gaps are:

- whether `cardConfig` is canonical data or sparse overrides layered over the existing flat card settings,
- whether desktop values should live in top-level settings or inside nested `cardConfig.breakpoints.desktop`,
- whether card breakpoints should resolve from viewport width or actual container width,
- how zero-valued overrides and value/unit pairs are distinguished from "unset".

My recommendation is to keep the current flat card settings as the canonical base in v1 and make `cardConfig` a sparse override surface. That avoids repeating the full `galleryConfig` legacy-bridge complexity while still delivering breakpoint-aware card layout.

---

## Current Codebase Findings

### 1. The gallery model is reusable, but not all of it should be copied

`galleryConfig` already proves a few useful patterns:

- nested breakpoint payloads are workable,
- `SettingsPanel` can save nested config and keep the rest of the UI stable,
- `mergeSettingsWithDefaults()` can merge nested config with a flat base.

But the card feature is structurally simpler than the gallery feature:

- there is no scope dimension (`unified` / `image` / `video`),
- the card settings already exist as a coherent top-level base surface,
- there is no pre-existing need for a PHP-side legacy bridge back onto flat card fields.

Recommendation:

- reuse the breakpoint cascade pattern,
- do not copy the gallery common/adapter split or its legacy bridge machinery unless a concrete requirement appears.

### 2. `SettingsResponse` type drift is no longer the blocker it was earlier

`apiClient.ts` now defines `SettingsResponse extends Partial<GalleryBehaviorSettings>`.

That means once `cardConfig` is added to the canonical shared type, the API client surface will inherit it automatically. This is good news for phase 5: the type layer no longer needs a separate cleanup pass before card breakpoint work can begin.

### 3. The current settings-panel sync path is gallery-specific

`SettingsPanel.updateSetting()` currently syncs flat gallery keys into nested `galleryConfig` through `syncLegacyGallerySettingToConfig()`, and save explicitly strips `LEGACY_GALLERY_SETTING_KEYS`.

That behavior should not be copied for cards unless desktop values are moved into nested state. If desktop/base card values stay flat and only breakpoint overrides live in `cardConfig`, then:

- normal card controls can continue updating flat settings directly,
- breakpoint-specific controls can update `cardConfig` directly,
- save can persist both without a bridge function.

This is the safest v1 model.

### 4. `CardGallery` still uses viewport-style column logic and ignores `cardAutoColumnsBreakpoints`

`CardGallery` currently derives column count from viewport media queries, not from the actual gallery container width, and it does not use `resolveColumnsFromWidth()` or `cardAutoColumnsBreakpoints`.

That matters because phase 8 is supposed to integrate `useBreakpoint()` and preserve the advanced auto-columns engine. If that is not corrected, the new breakpoint resolver will still be sitting on top of a card grid that resolves width in a second, different way.

### 5. Zero values and unit pairs need explicit handling

Several planned breakpoint fields allow meaningful zero values:

- `cardGridColumns = 0` means auto,
- `cardMaxWidth = 0` means unlimited,
- `cardMinHeight = 0` means no minimum,
- `cardGalleryMinHeight = 0` / `cardGalleryMaxHeight = 0` mean no constraint,
- offsets can validly be `0`.

So the implementation cannot treat falsy as "not configured".
It must distinguish:

- `undefined` = inherit,
- `0` = explicit override.

The same applies to value/unit pairs:

- unit-only overrides should be rejected or prevented,
- clear actions for dimension fields must remove both the numeric value and the unit override together.

---

## Recommended Implementation Decisions Before Phase 5

### 1. Keep flat card settings as the canonical base in v1

Use the existing top-level card settings as the desktop/base source of truth.
Treat `cardConfig` as sparse breakpoint overrides layered on top of that base.

Benefits:

- no duplicate desktop source of truth,
- no need for a `collectLegacyCardSettingValues()` bridge,
- no need for `syncLegacyCardSettingToConfig()` style live mirroring,
- lower risk in `SettingsPanel`,
- easier rollback if the feature needs to be narrowed.

### 2. Make `cardConfig` sparse, not fully seeded

Recommended default:

```ts
cardConfig: {
  breakpoints: {},
}
```

Not recommended:

- pre-populating desktop, tablet, and mobile with explicit copies of current flat defaults.

If all three breakpoints are pre-seeded, the UI cannot honestly represent inherited values, reset-to-inherited becomes noisy, and the stored payload becomes much larger than necessary.

### 3. Prefer flat desktop editing over nested desktop editing

The planning doc currently implies a `desktop` branch inside `cardConfig`.
That is technically possible, but it is not the safest first implementation.

Recommended UI behavior:

- Desktop tab edits the flat base settings directly.
- Tablet and Mobile tabs edit sparse overrides under `cardConfig.breakpoints.tablet` and `cardConfig.breakpoints.mobile`.
- The resolver still supports `desktop` overrides if they ever appear, but the UI does not need to author them in v1.

If desktop is made nested immediately, you will also need:

- live sync from current flat controls into nested desktop state,
- projection back out for the rest of the settings UI,
- conflict-resolution rules when flat and nested desktop disagree.

That is avoidable complexity.

### 4. Resolve card breakpoints from container width, not viewport width

For the card gallery, container width is the right source.
This app can live inside WordPress layouts where the actual render width is narrower than the viewport.

Phase 8 should use a container-based breakpoint source for the card grid.
If you rely on viewport media queries here, users will see breakpoint changes that do not match the actual space the cards have available.

### 5. Keep PHP persistence simple

Persist `card_config` and sanitize it carefully, but do not add a PHP flat-field bridge for card settings unless you find a real PHP consumer that needs resolved breakpoint values.

The frontend runtime is where the card breakpoint cascade matters. Persistence and transport are required. A second PHP compatibility layer is not automatically required.

---

## Deep Phase Plan

### Phase 5: Types and resolution

#### Goal

Introduce a minimal, explicit, sparse card breakpoint data model and a resolver that returns the effective card settings for one breakpoint without changing the rest of the settings shape.

#### Recommended TypeScript surface

1. Add a shared breakpoint union instead of duplicating string literals again:

```ts
export type ResponsiveBreakpoint = 'desktop' | 'tablet' | 'mobile';
export type GalleryConfigBreakpoint = ResponsiveBreakpoint;
export type CardConfigBreakpoint = ResponsiveBreakpoint;
```

2. Define a single explicit key list for overridable card fields:

```ts
export const CARD_BREAKPOINT_OVERRIDE_KEYS = [
  'cardGridColumns',
  'cardMaxColumns',
  'cardMaxWidth',
  'cardMaxWidthUnit',
  'cardGapH',
  'cardGapHUnit',
  'cardGapV',
  'cardGapVUnit',
  'cardScale',
  'cardJustifyContent',
  'cardGalleryVerticalAlign',
  'cardAspectRatio',
  'cardThumbnailHeight',
  'cardThumbnailHeightUnit',
  'cardMinHeight',
  'cardMinHeightUnit',
  'cardBorderRadius',
  'cardBorderRadiusUnit',
  'cardGalleryMinHeight',
  'cardGalleryMinHeightUnit',
  'cardGalleryMaxHeight',
  'cardGalleryMaxHeightUnit',
  'cardGalleryOffsetX',
  'cardGalleryOffsetXUnit',
  'cardGalleryOffsetY',
  'cardGalleryOffsetYUnit',
  'cardDisplayMode',
  'cardRowsPerPage',
] as const;
```

3. Derive the override type from that key list:

```ts
type CardBreakpointOverrideKey = typeof CARD_BREAKPOINT_OVERRIDE_KEYS[number];
export type CardBreakpointOverrides = Partial<Pick<GalleryBehaviorSettings, CardBreakpointOverrideKey>>;
```

4. Add the config container:

```ts
export interface CardConfig {
  breakpoints?: Partial<Record<CardConfigBreakpoint, CardBreakpointOverrides>>;
}
```

5. Add `cardConfig?: CardConfig` to `GalleryBehaviorSettings` and `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`.

#### Resolver behavior

Recommended helper:

```ts
resolveCardBreakpointSettings(
  settings: GalleryBehaviorSettings,
  breakpoint: CardConfigBreakpoint,
): GalleryBehaviorSettings
```

Behavior:

1. Start with a shallow clone of the incoming full settings object.
2. Overlay `cardConfig.breakpoints.desktop` if present.
3. Overlay `cardConfig.breakpoints.tablet` when breakpoint is `tablet` or `mobile`.
4. Overlay `cardConfig.breakpoints.mobile` when breakpoint is `mobile`.
5. Return the cloned full settings object.

Why return the full settings object:

- `CardGallery` and `CampaignCard` already accept full `GalleryBehaviorSettings`,
- phase 8 can swap to a resolved settings object with minimal call-site churn,
- tests stay simpler because downstream renderers continue receiving the same shape.

#### Helper functions that are worth adding now

In the same file, or a small companion utility if the file grows too large:

- `cloneCardConfig(config)`
- `pruneCardConfig(config)`
- `parseCardConfig(input)`
- `getCardBreakpointOverride(config, breakpoint, key)`
- `clearCardBreakpointOverride(config, breakpoint, key)`
- `clearCardDimensionOverride(config, breakpoint, valueKey, unitKey)`

Important pruning rule:

- remove `undefined` keys only,
- preserve `0`, `false`, and empty-string enum values when valid,
- strip empty breakpoint objects after field deletion.

#### Important design rule for dimension pairs

Do not allow a unit override without a numeric override in the same breakpoint object.
A tablet override of `cardMaxWidthUnit: 'rem'` with no `cardMaxWidth` override would reinterpret the inherited desktop numeric value in a new unit, which is too error-prone.

Recommended policy:

- value-only override: allowed, inherits unit,
- value + unit override: allowed,
- unit-only override: disallowed.

#### Phase 5 tests

Add targeted tests for:

- desktop/tablet/mobile cascade,
- `undefined` vs `0`,
- value-only override behavior,
- unit-only override rejection/pruning,
- `pruneCardConfig()` preserving explicit zero values.

### Phase 6: PHP registry and sanitization

#### Goal

Persist `card_config` cleanly through the WordPress settings pipeline without creating a second compatibility bridge.

#### Registry changes

Add `card_config` to the settings defaults in `class-wpsg-settings-registry.php`.

Recommended default:

```php
'card_config' => [
    'breakpoints' => [],
],
```

Do not seed tablet/mobile with explicit values.

#### Sanitizer strategy

Add a dedicated `sanitize_card_config_payload()` method in `class-wpsg-settings-sanitizer.php`.

Recommended structure:

- decode JSON string or accept array input,
- only allow `desktop`, `tablet`, `mobile`,
- only allow keys from a dedicated `$nested_card_field_map`,
- sanitize each leaf by reusing the registered flat-key metadata already in the registry,
- preserve explicit zero values,
- drop unknown keys and empty breakpoint nodes.

A dedicated card map is clearer than trying to squeeze `cardConfig` into the gallery sanitizer:

```php
private static $nested_card_field_map = [
    'cardGridColumns' => 'card_grid_columns',
    'cardMaxColumns' => 'card_max_columns',
    'cardMaxWidth' => 'card_max_width',
    'cardMaxWidthUnit' => 'card_max_width_unit',
    // ...
];
```

#### Pair validation rules

For dimension pairs:

- if a unit key is present without its numeric pair, reject the unit,
- if numeric value is present and unit is absent, allow it and let the resolver inherit the base unit.

#### PHP transport note

Because `SettingsResponse` now derives from `Partial<GalleryBehaviorSettings>`, once `cardConfig` is part of the shared type and the PHP output includes `card_config`, the API client surface will stay in sync automatically.

#### PHP bridge recommendation

Do not add:

- `apply_card_config_legacy_bridge()`,
- `collect_legacy_card_setting_values()`,
- any projection of nested card config back onto flat card fields in PHP,

unless you identify a real PHP-side consumer that reads card layout settings after load.

That bridge is necessary for `galleryConfig` because older PHP and REST flows already depended on those fields. It is not automatically justified for cards.

#### Phase 6 tests

Add PHP tests for:

- valid sparse payloads,
- invalid breakpoint keys,
- invalid nested field names,
- zero-valued overrides,
- unit-only override rejection,
- JSON-string payload handling.

### Phase 7: Settings UI

#### Goal

Add responsive card editing without turning the card settings section into a second source-of-truth trap.

#### Recommended UI model

Keep breakpoint editing inside the existing `Card Grid & Pagination` accordion.
Do not create a separate card-config drawer in v1.

Recommended interaction:

- Desktop / Tablet / Mobile segmented control at the top of the accordion,
- Desktop tab edits current flat card settings directly,
- Tablet / Mobile tabs edit sparse overrides under `cardConfig`,
- each overrideable field can be inherited, explicitly overridden, or cleared back to inherited.

#### Why desktop should stay flat

This keeps `SettingsPanel.updateSetting()` simple:

- existing desktop/base fields continue using `updateSetting(key, value)`,
- tablet/mobile overrides use `updateSetting('cardConfig', nextConfig)`.

No gallery-style live bridge is needed.

#### UI helper functions

Within `CampaignCardSettingsSection.tsx` or a small card-config helper:

- `getResolvedCardUiValue(settings, activeBreakpoint, key)`
- `isCardValueInherited(settings.cardConfig, activeBreakpoint, key)`
- `setCardBreakpointOverride(...)`
- `clearCardBreakpointOverride(...)`
- `clearCardDimensionOverride(...)`

The UI should never rely on `value || fallback`.
It must preserve real zero values.

#### Field behavior

For tablet/mobile tabs:

- inherited fields show the resolved current value and its inheritance source,
- explicit override fields render as normal editable inputs,
- dimension fields need a clear action that removes both value and unit overrides together,
- controls whose meaning depends on another field should use the resolved value, not only the local override.

Examples:

- `cardRowsPerPage` visibility still depends on the resolved `cardDisplayMode`,
- `cardMaxColumns` visibility still depends on the resolved `cardGridColumns`,
- a tablet explicit `cardGridColumns = 0` must still mean explicit auto mode, not inherit.

#### Suggested UI messaging

Use short helper text such as:

- `Inherited from desktop: 16px`
- `Inherited from tablet: Auto`
- `Override for mobile`

This matters because several fields use `0` as a real semantic value and need a user-visible explanation.

#### Suggested implementation pattern

Do not rewrite the whole section at once.
Refactor only the overrideable controls in `Card Grid & Pagination` to go through a local value adapter:

- `readCardField(key)`
- `writeCardField(key, value)`
- `clearCardField(key)`
- `readCardDimensionUnit(key)`

The appearance and internals accordions can stay flat/base-only.

#### Phase 7 tests

Add React tests for:

- switching breakpoint tabs,
- inherited placeholder rendering,
- explicit zero override behavior,
- clear-to-inherited behavior,
- conditional field visibility using resolved values.

### Phase 8: Rendering integration

#### Goal

Make `CardGallery` render from resolved card settings for the active breakpoint and eliminate the current split between viewport media-query logic and card-specific width rules.

#### Recommended runtime shape

In `CardGallery.tsx`:

1. Attach a container ref to the actual gallery container.
2. Resolve breakpoint from container width.
3. Build a resolved settings object with `resolveCardBreakpointSettings()`.
4. Use the resolved settings object for all card-grid and card-rendering logic.

Recommended pattern:

```ts
const breakpoint = useBreakpoint(cardGalleryContainerRef, { source: 'container' });
const resolvedCardSettings = useMemo(
  () => resolveCardBreakpointSettings(galleryBehaviorSettings, breakpoint),
  [galleryBehaviorSettings, breakpoint],
);
```

Then use `resolvedCardSettings` for:

- `cardGridColumns`,
- `cardMaxColumns`,
- `cardGapH` / `cardGapV`,
- `cardMaxWidth` / `cardMaxWidthUnit`,
- `cardScale`,
- `cardJustifyContent`,
- `cardGalleryVerticalAlign`,
- `cardGalleryMinHeight` / `cardGalleryMaxHeight`,
- `cardGalleryOffsetX` / `cardGalleryOffsetY`,
- `cardDisplayMode`,
- `cardRowsPerPage`,
- `CampaignCard` props and `settings`.

#### Container width vs breakpoint label

`useBreakpoint()` only returns a label today.
Phase 8 also needs actual width if auto columns should honor `cardAutoColumnsBreakpoints`.

Recommended options:

- add a tiny companion width measurement hook for the card container, or
- extend the existing hook only if the API stays clean.

Do not fall back to viewport media queries for column math if the breakpoint label is container-based. That would leave two contradictory responsive systems in the same component.

#### Auto columns recommendation

When the resolved `cardGridColumns` is `0`, calculate columns from actual container width using `resolveColumnsFromWidth(containerWidth, 0, settings.cardAutoColumnsBreakpoints)` and then cap with resolved `cardMaxColumns`.

This is more consistent with the rest of the responsive infrastructure and finally makes `cardAutoColumnsBreakpoints` authoritative.

#### Scale with units

`CampaignCard.tsx` currently rounds scaled numeric values before sending them to `toCss()`.
For unitized values, especially `%`, `em`, and `rem`, that is unnecessarily lossy.

Recommended adjustment in phase 8:

- preserve fractional scaled values,
- only round if a specific call site truly requires integer pixels.

Examples:

- `50% * 1.5` should remain `75%`,
- `18rem * 1.1` should remain `19.8rem`, not `20rem`.

#### Pagination behavior on breakpoint changes

Breakpoint-driven column changes affect:

- `effectiveColumns`,
- `cardsPerPage`,
- `totalPages`.

Phase 8 should explicitly define what happens when the breakpoint changes mid-session.
My recommendation:

- clamp invalid page indices as today,
- additionally reset `currentPage` to `0` when the breakpoint label changes.

That is less surprising than keeping the old page index while the page boundaries shift underneath the user.

#### Scope boundary

Phase 8 should not change:

- modal viewer rendering,
- gallery adapter breakpoint resolution,
- campaign viewer breakpoints.

Keep it limited to card gallery rendering and card sizing/layout behavior.

#### Phase 8 tests

Add or update tests for:

- resolved breakpoint settings passed into `CampaignCard`,
- tablet/mobile overrides affecting grid gaps, columns, and pagination,
- explicit auto mode (`cardGridColumns = 0`) using `cardAutoColumnsBreakpoints`,
- page reset or clamp on breakpoint change,
- fixed-width and responsive-width branches.

---

## Recommended Implementation Order Inside Phases 5-8

1. Phase 5 types and resolver
2. Phase 5 tests
3. Phase 6 PHP registry and sanitizer
4. Phase 6 PHP tests
5. Phase 7 UI helpers and breakpoint tabs
6. Phase 7 React tests
7. Phase 8 runtime integration
8. Phase 8 `CardGallery` / `CampaignCard` tests
9. Final manual QA

---

## Manual QA Checklist

- Desktop base settings still behave exactly like today when `cardConfig` is empty.
- Tablet override with no mobile override cascades correctly to mobile.
- Mobile explicit zero override is preserved.
- Clear override restores inherited value and source label.
- Paginated mode recomputes cleanly across breakpoint changes.
- Auto columns honor `cardAutoColumnsBreakpoints`.
- Fixed-width cards and responsive-width cards both obey resolved settings.
- Save/load round-trip preserves sparse `cardConfig` without inflating empty nodes.

---

## Final Recommendation

The core idea for phases 5-8 is sound, but the safest version is not a literal copy of the `galleryConfig` architecture.

The careful path is:

- flat card settings remain the base,
- `cardConfig` stays sparse,
- desktop edits remain flat in v1,
- tablet/mobile edits write nested overrides,
- the runtime resolves from container width,
- zero values and unit pairs are treated explicitly.

If those constraints are followed, phases 5-8 should be much safer to implement than the current planning text implies.