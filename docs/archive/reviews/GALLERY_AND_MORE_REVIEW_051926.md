# Gallery Plugin & Framework Review — 2026-05-19

Full-stack review of the WP Super Gallery plugin: React frontend (adapters, hooks, services, utils, types), PHP backend (settings, REST API, CPT, embed), and the adapter framework.

---

## 1. Performance: Gallery Config Cloning is O(n³)

**File:** `src/utils/galleryConfig.ts`

Functions like `setGalleryAdapterSetting`, `setRepresentativeGalleryCommonSetting`, and `cloneGalleryConfig` all iterate over 3 breakpoints × 3 scopes = 9 iterations, and `cloneGalleryConfig` does shallow spreads recursively every time. These are called on every settings change in the SettingsPanel, which means each keystroke triggers a full config tree clone.

**Suggestion:** Add a structural sharing optimization — instead of cloning the entire config tree, use immutable update patterns that only clone the path that changed. For example, `setGalleryAdapterSetting` could be:

```ts
// Instead of iterating all 9 cells, only clone the affected path
function setGalleryAdapterSetting(config, key, value): GalleryConfig {
  const nextConfig = { ...config, breakpoints: { ...config.breakpoints } };
  for (const breakpoint of GALLERY_BREAKPOINTS) {
    // Only clone breakpoints that actually have matching adapters
    const bpConfig = nextConfig.breakpoints[breakpoint];
    if (!bpConfig) continue;
    // ... shallow-clone only changed scopes
  }
}
```

Even better: wrap settings state in `useImmer` or use a proxy-based approach so the editor doesn't clone on every change.

---

## 2. Architecture: `ApiClient` is Growing Without Bound

**File:** `src/services/apiClient.ts` (~500 lines)

`ApiClient` has become a god class — it combines HTTP transport logic (timeout, nonce retry, auth) with 20+ domain-specific endpoints (campaigns, analytics, categories, templates, tags, access requests, audit log download). Each new feature adds more methods.

**Suggestion:** Extract domain-specific API modules that compose on top of a thin transport client:

```ts
// src/services/transport/HttpTransport.ts — thin, tested, reusable
class HttpTransport { /* get, post, put, delete with timeout + nonce retry */ }

// src/services/campaignsApi.ts — domain-specific
export function createCampaignsApi(transport: HttpTransport) {
  return {
    list: () => transport.get<Campaign[]>('/campaigns'),
    duplicate: (id, opts) => transport.post(...),
    // ...
  };
}
```

This also makes mocking in tests much cleaner — you can inject a mock transport instead of mocking 20 individual methods.

---

## 3. Architecture: PHP Settings Facade Has Too Many Delegation Methods

**File:** `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` (~300 lines)

Almost every method in `WPSG_Settings` is a one-line delegation to another class (`WPSG_Settings_Core_Fields::render_*`, `WPSG_Settings_Renderer::*`, etc.). This adds an unnecessary indirection layer — callers go `WPSG_Settings::render_theme_field()` → `WPSG_Settings_Core_Fields::render_theme_field()`.

**Suggestion:** Either (a) remove the facade and call the sub-classes directly from the renderer, or (b) use `__callStatic` to auto-delegate and remove the boilerplate:

```php
public static function __callStatic($name, $args) {
    $class = str_starts_with($name, 'render_')
        ? WPSG_Settings_Core_Fields::class
        : WPSG_Settings_Renderer::class;
    return call_user_func_array([$class, $name], $args);
}
```

---

## 4. Type Safety: Unsafe `as any` Casts in `mergeSettingsWithDefaults`

**File:** `src/utils/mergeSettingsWithDefaults.ts`

```ts
(result as any)[key] = parsedTypographyOverrides;
(result as any)[key] = incoming;
```

These bypass TypeScript entirely. If a new field is added to `DEFAULT_GALLERY_BEHAVIOR_SETTINGS` with a type that doesn't match the incoming value, the cast silently allows it.

**Suggestion:** Use a typed helper:

```ts
type DefaultValue<T> = T extends undefined ? never : T;

function assignSetting<K extends keyof GalleryBehaviorSettings>(
  result: GalleryBehaviorSettings,
  key: K,
  value: GalleryBehaviorSettings[K]
): void {
  result[key] = value;
}
```

---

## 5. Bug Risk: `useLightbox` Body Scroll Lock is Not Reentrant

**File:** `src/hooks/useLightbox.ts`

```ts
const lockBodyScroll = useCallback(() => {
  document.body.style.overflow = 'hidden';
}, []);

const unlockBodyScroll = useCallback(() => {
  document.body.style.overflow = '';
}, []);
```

If two lightboxes are mounted (e.g., a nested lightbox inside a modal), opening the second locks, then closing it unlocks — even though the first lightbox is still open. The body scroll is restored prematurely.

**Suggestion:** Use a reference counter:

```ts
const lockCount = useRef(0);

const lockBodyScroll = useCallback(() => {
  lockCount.current++;
  if (lockCount.current === 1) document.body.style.overflow = 'hidden';
}, []);

const unlockBodyScroll = useCallback(() => {
  lockCount.current--;
  if (lockCount.current <= 0) {
    lockCount.current = 0;
    document.body.style.overflow = '';
  }
}, []);
```

---

## 6. Performance: Carousel Visible Cards Normalization is Redundantly Called

**File:** `src/components/Galleries/Adapters/carouselBehavior.ts`

`normalizeCarouselVisibleCards()` wraps `Math.max(1, Math.round(...))` and is called in `shouldLoopCarousel`, `shouldUseSyntheticCarouselLoop`, `getCarouselAlign`, `getCarouselContainScroll`, and `getCarouselFocusIndex`. Many of these are called per-frame during carousel interaction.

**Suggestion:** Pre-normalize `visibleCards` once in the component that uses these functions, and pass the normalized value down. Move normalization to the call site rather than repeating it in every pure function.

---

## 7. UX: `useBreakpoint` Initial Width is 0, Causing Flash

**File:** `src/hooks/useBreakpoint.ts`

```ts
const [width, setWidth] = useState<number>(0);
```

On first render, `width` is 0 and `breakpoint` is `'desktop'`. The actual measurement doesn't happen until the `useEffect` runs (after paint). This means the first render uses wrong breakpoint values, and consumers that depend on `width` (like masonry columns) may flash wrong layouts.

**Suggestion:** For container mode, synchronously measure on first render:

```ts
const initialWidth = typeof window !== 'undefined'
  ? containerRef.current?.clientWidth ?? 0
  : 0;
const [width, setWidth] = useState(initialWidth);
```

Or use `useSyncExternalStore` for consistent snapshot semantics.

---

## 8. Maintainability: Adapter Setting Group Definitions are 400+ Lines of Inline Data

**File:** `src/components/Galleries/Adapters/adapterRegistry.ts`

`SETTING_GROUP_DEFINITIONS` is a massive ~400-line inline object literal. Adding a new setting field requires editing this file AND the Zod schema in `settingsSchemas.ts` AND the TypeScript types in `types/index.ts` AND the PHP registry in `class-wpsg-settings-registry.php`. There's no single source of truth.

**Suggestion:** Generate the PHP registry and Zod schema from the TypeScript adapter definitions at build time. A Vite plugin or build script can:

1. Read `SETTING_GROUP_DEFINITIONS` from the registry
2. Generate `settingsSchemas.ts` Zod validators from field definitions
3. Generate `class-wpsg-settings-registry.php` defaults/ranges from the same source

This eliminates the 4-way sync problem.

---

## 9. Security: PHP `wpsg_run_schedule_auto_archive` Has N+1 Query Pattern

**File:** `wp-plugin/wp-super-gallery/wp-super-gallery.php`

```php
foreach ($query->posts as $post_id) {
    update_post_meta($post_id, 'status', 'archived');
    $archived_count++;
}
```

Each `update_post_meta` is a separate DB query. For campaigns with hundreds of expired items, this is inefficient.

**Suggestion:** Batch with `$wpdb->update` or `wp_update_post`:

```php
global $wpdb;
$placeholders = implode(',', array_fill(0, count($query->posts), '%d'));
$wpdb->query($wpdb->prepare(
    "UPDATE {$wpdb->postmeta} SET meta_value = 'archived'
     WHERE meta_key = 'status' AND post_id IN ($placeholders)",
    ...$query->posts
));
```

---

## 10. Testing Gap: No Integration Tests for Adapter Resolution Path

The adapter registry has unit tests for individual functions, but there's no integration test that validates the full pipeline: settings → `resolveGalleryConfig` → `resolveAdapterId` → `resolveAdapter` → component render. This is the critical path that broke during Phase 24 (the theme-preview bug).

**Suggestion:** Add a Playwright or React Testing Library integration test that:

1. Sets campaign gallery config with nested breakpoints
2. Renders the campaign viewer at different container widths
3. Asserts the correct adapter component is mounted for each breakpoint

---

## Summary Table

| # | Area | Impact | Effort |
|---|------|--------|--------|
| 1 | Config cloning O(n³) | Perf (settings editor lag) | Medium |
| 2 | ApiClient god class | Maintainability, testability | Medium |
| 3 | PHP settings delegation | Code clarity | Small |
| 4 | `as any` casts | Type safety | Small |
| 5 | Non-reentrant scroll lock | Bug (nested lightboxes) | Small |
| 6 | Redundant normalization | Perf (carousel) | Small |
| 7 | Breakpoint flash | UX (layout flash) | Small |
| 8 | 4-way setting sync | Maintainability | Large |
| 9 | N+1 archive queries | Perf (cron) | Small |
| 10 | No integration tests | Reliability | Medium |

## Decision Matrix

| # | Decision | Phase placement | Notes |
|---|----------|-----------------|-------|
| 1 | Accept with changes | Phase 31 / P31-C | Real gallery-config edit-path issue, but the `O(n³)` framing is overstated. Treat it as measured update-path and structural-sharing work. |
| 2 | Accept, but out of gallery scope | Phase 32 / P32-C | Real shared-infrastructure refactor. Keep it out of the gallery phase and track it in the shared-maintenance lane. |
| 3 | Accept, but out of gallery scope | Phase 32 / P32-B | Valid cleanup, but not strong enough to widen the gallery phase. |
| 4 | Accept with changes | Phase 31 / P31-A | Keep it with gallery reliability because it sits on the gallery settings hydration path. |
| 5 | Accept | Phase 31 / P31-A | Real bug. Fix with shared scroll-lock coordination across hook instances rather than a per-instance counter. |
| 6 | Change and defer | Follow-on candidate | The component already pre-normalizes `visibleCards` once at the callsite, so this should be helper cleanup, not a standalone performance track. |
| 7 | Accept with changes | Phase 31 / P31-A | Treat it as a first-render and late-ref contract issue rather than only a `useState` initializer problem. |
| 8 | Expand into pre-evaluation | Phase 31 / P31-D | Real maintenance issue, but large enough that canonical-source and codegen boundaries need design first. |
| 9 | Accept, but out of gallery scope | Phase 32 / P32-A | Good small backend maintenance item, but not gallery-system phase work. |
| 10 | Accept | Phase 31 / P31-B | Add one real integration path that exercises settings -> resolved adapter -> rendered component. |

## Recommended Gallery-Phase Starting Order

1. **#5** — Scroll lock bug fix (small fix, real bug)
2. **#4** — Type safety on settings hydration (low effort, central gallery path)
3. **#7** — Breakpoint first-render contract (quick UX/correctness win)
4. **#10** — Adapter-resolution integration coverage (protect the critical path)
5. **#1** — Gallery-config update-path optimization (measurement-backed refactor)
6. **#8** — Single-source-of-truth pre-evaluation (design-first)

## Shared-Infrastructure Follow-On Order

These items now live in `PHASE32_REPORT.md`.

1. **#9** — Scheduled archive batching (`P32-A`)
2. **#3** — PHP settings facade cleanup (`P32-B`)
3. **#2** — `ApiClient` modularization (`P32-C`)
4. **#6** — Carousel helper cleanup only if adjacent carousel work is already in flight
