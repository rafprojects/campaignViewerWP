# Phase 36 — Open Follow-Up Findings

**Date:** 2026-05-30
**Purpose:** Pre-implementation gate for P36-A and P36-B. Resolves the two open follow-ups
listed in `docs/PHASE36_REPORT.md § Open follow-ups` before implementation details are locked.

---

## 1. Multi-root localStorage Scoping (P36-A pre-condition)

### 1.1 Mounting architecture

`src/main.tsx` supports three distinct mounting modes:

| Mode | Trigger | Root count |
|------|---------|-----------|
| **`#root` mount path** | `#root` element exists | 1 root → `createRoot(document.getElementById('root'))` |
| **Independent shortcodes** | no `#root`, `useSharedRoot === false` (default) | N roots → one `createRoot()` per `.wp-super-gallery` element |
| **Shared-root shortcodes** | no `#root`, `wpsgConfig.sharedRoot === true` | 1 hidden root + N portal instances, each with its own `portalKey` |

**Conclusion:** The app is genuinely multi-root because multiple shortcode roots are real today.
The current bootstrap takes the `#root` path or the shortcode path, not both in the same page
load, but all mounts still share the same browser-origin localStorage.

### 1.2 `#root` + shortcode nuance

The shortcode handler (`class-wpsg-embed.php:11`) registers `[super-gallery]` globally, but the
current frontend bootstrap in `src/main.tsx` only scans `.wp-super-gallery` hosts when `#root` is
absent. That means admin-`#root` + shortcode simultaneous mounting is **not** the current runtime
path.

The important planning fact remains: all mount modes share the same `window.localStorage`
(per-origin, not per DOM subtree), and multiple shortcode mounts can already coexist on one page.
That is sufficient to require per-root reload-safe key prefixing.

### 1.3 Shadow DOM does not isolate localStorage

Each React root gets its own shadow DOM boundary (`host.attachShadow({ mode: 'open' })`). Shadow
DOM is a CSS/DOM boundary only. `window.localStorage` is shared across the entire origin
regardless of shadow root boundaries. Per-root key prefixing is the only isolation mechanism.

### 1.4 Existing localStorage key inventory

All current `wpsg_`/`wpsg-` keys are globally scoped — none carry a root-ID prefix.

**Auth / global** _(intentionally shared across all roots)_

| Key | Purpose | File |
|-----|---------|------|
| `wpsg_access_token` | JWT token | `src/services/auth/WpJwtProvider.ts:12` |
| `wpsg_user` | User profile (JSON) | `src/services/auth/WpJwtProvider.ts:13` |
| `wpsg_permissions` | Permissions array | `src/services/auth/WpJwtProvider.ts:14` |
| `wpsg-theme-id` | Theme selection | `src/contexts/ThemeContext.tsx:42` |
| `wpsg_debug` | Debug flag | `src/utils/debug.ts:9` |

**Admin UI** _(effectively single-root; lives only inside the admin panel)_

| Key | Purpose | File |
|-----|---------|------|
| `wpsg_admin_active_tab` | Active admin tab | `src/components/Admin/AdminPanel.tsx:66` |
| `wpsg_access_mode` | Lock / hide mode | `src/App.tsx:75` |
| `wpsg-authbar-pos` | Floating auth bar position | `src/components/Auth/AuthBarFloating.tsx:8` |
| `wpsg-recent-fonts` | Recently used font names | `src/hooks/useRecentFonts.ts:3` |
| `wpsg_media_sortMode` | Media library sort preference | `src/components/Admin/MediaTab.tsx:335` |
| `wpsg_media_viewMode_${campaignId}` | View mode per campaign | `src/components/Admin/MediaTab.tsx:307` |
| `wpsg_media_cardSize_${campaignId}` | Card size per campaign | `src/components/Admin/MediaTab.tsx:312` |
| `wpsg_media_listPage_${campaignId}` | List page per campaign | `src/components/Admin/MediaTab.tsx:317` |
| `wpsg_media_orphanFilter_${campaignId}` | Orphan media filter per campaign | `src/components/Admin/MediaTab.tsx:326` |

**Layout builder** _(admin-only; all in `src/components/Admin/LayoutBuilder/`)_

| Key | Purpose | File |
|-----|---------|------|
| `wpsg_layout_draft_${templateId}` | Auto-saved layout draft | `LayoutBuilderModal.tsx:229` (`STORAGE_KEY_PREFIX` in `useLayoutBuilderState.ts:22`) |
| `wpsg_builder_layout` | Builder workspace state | `LayoutBuilderModal.tsx:806` |
| `wpsg_builder_snap_mode` | Snap mode | `LayoutBuilderModal.tsx:147` |
| `wpsg_builder_show_grid` | Grid visibility | `LayoutBuilderModal.tsx:151` |
| `wpsg_builder_grid_size` | Grid size (px) | `LayoutBuilderModal.tsx:154` |
| `wpsg_builder_show_rulers` | Rulers visibility | `LayoutBuilderModal.tsx:157` |
| `wpsg_builder_show_measurements` | Measurements visibility | `LayoutBuilderModal.tsx:160` |
| `wpsg_builder_design_assets_open` | Design-assets panel state | `LayoutBuilderModal.tsx:172` |
| `wpsg_builder_preview_preset` | Preview preset | `LayoutBuilderCanvasPanel.tsx:187` |
| `wpsg_builder_custom_preview_width` | Custom preview width | `LayoutBuilderCanvasPanel.tsx:190` |
| `wpsg_builder_show_preview_frame` | Preview frame toggle | `LayoutBuilderCanvasPanel.tsx:193` |

**Total: 21 distinct key patterns.** None carry a root-ID prefix.

### 1.5 The shared-root `portalKey` exists — generalize it

`src/main.tsx:220` already computes a stable per-root identifier for every shortcode mount:

```typescript
const portalKey = host.id || (host.dataset.wpsgKey ??= `wpsg-${Math.random().toString(36).slice(2, 10)}`)
```

That identifier is already threaded into the shared-root render path as `portalKey`. Independent
shortcode mounts do **not** yet create the same key, so P36-A should factor this into a mount-wide
helper reused by every render path rather than relying on the shared-root path alone.

### 1.6 Decision: key convention for `useReloadSafeView`

**Use `wpsg_view_<rootId>_<feature>`** (per-root prefix).

Rationale:
- Multiple shortcode roots are a real current collision surface (see §1.1 / §1.2).
- Shadow DOM does not isolate localStorage (see §1.3).
- The `portalKey` pattern already exists as the right starting point, but it must be made universal
  across mount paths (see §1.5).
- The cost of adding a root prefix is a one-time root-id helper + `RootIdContext` wired into every
  `renderApp()` path.
- Prevents silent key collisions if the single-instance convention is ever relaxed.

**Implementation note for P36-A:**
1. Add a `RootIdContext` to `src/contexts/`.
2. In `src/main.tsx`, create a shared helper that resolves `rootId` for every mount path before
  `renderApp()` is called.
3. Wrap the tree with `<RootIdContext.Provider value={rootId}>` and have
  `useReloadSafeView` construct keys as `wpsg_view_${rootId}_${feature}`.
4. Absorb `wpsg_admin_active_tab` into the same reload-safe/root-scoped mechanism; defer the
  broader legacy admin/media key audit to Phase 37.

**Keys that remain globally scoped (no rootId prefix):**
Auth/theme keys (`wpsg_access_token`, `wpsg_user`, `wpsg_permissions`, `wpsg-theme-id`, `wpsg_debug`) are intentionally shared and should stay global. All builder keys are admin-only and are unaffected by shortcode multi-root concerns. Existing media/admin preference keys outside the reload-safe slice are deferred to the Phase 37 audit.

---

## 2. Companies-List Source (P36-B pre-condition)

### 2.1 PHP REST endpoint — already exists

Route: `GET /wp-json/wp-super-gallery/v1/companies`
Registered: `class-wpsg-rest.php:720`
Handler: `list_companies()` at `class-wpsg-rest.php:3503`

Response shape (per item):

```json
{
  "id": 12,
  "name": "Acme Corp",
  "slug": "acme-corp",
  "campaignCount": 7,
  "activeCampaigns": 4,
  "archivedCampaigns": 2,
  "accessGrantCount": 3,
  "campaigns": [
    { "id": 101, "title": "Spring 2026", "status": "active" }
  ]
}
```

The response is paginated and cached. No additional PHP endpoint is needed.

### 2.2 Frontend hook — already exists

`useCompanies(apiClient: ApiClient, enabled: boolean)` — `src/services/adminQuery.ts:412`

```typescript
// Internal implementation references:
fetchCompanies()        → adminQuery.ts:280   (calls GET /companies)
getCompaniesQueryKey()  → adminQuery.ts:173   (TanStack Query key)
```

Returns `{ companies: CompanyInfo[], companiesLoading, companiesError, mutateCompanies }`.

This is sufficient for the existing admin-access surfaces, but **not** sufficient by itself for the
P36-B inline company selector because it currently fetches a single paginated page.

`CompanyInfo` interface (`adminQuery.ts:82`):

```typescript
export interface CompanyInfo {
  id: number;
  name: string;       // ← display name for Autocomplete
  slug: string;
  campaignCount: number;
  activeCampaigns: number;
  archivedCampaigns: number;
  accessGrantCount: number;
  campaigns: Array<{ id: number; title: string; status: string }>;
}
```

### 2.3 Campaign company fields

`AdminCampaign` interface (`adminQuery.ts:31`):

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | `string` | Company slug — this is what the REST `format_campaign` returns |
| `companyName` | `string?` | Human-readable name — optional in the interface, but not returned by the current core campaign formatter and should not be relied on as the primary display source without response enrichment |

Current rendering in `useCampaignsRows.tsx:85`:
```tsx
<Table.Td>{c.companyId || '—'}</Table.Td>
```
Displays the raw slug string; no autocomplete, no inline edit.

### 2.4 Decision: no new endpoint needed, but frontend work still is

The existing `/companies` endpoint is sufficient. **Do not add a new REST endpoint.**

However, P36-B should still add frontend infrastructure around that endpoint:

- Load an exhaustive companies selector dataset rather than relying on the current first-page-only
  `useCompanies()` behavior directly.
- Reuse a shared company-entry control in both CampaignsTab inline editing and
  UnifiedCampaignModal.
- Support two company mutation paths: existing-company selection by slug, and explicit new-company
  creation via `{ name, slug }` data.
- Extract/share the campaign update path so modal saves and inline edits use one contract.
- Enrich campaign read responses with stable company display data (`companyName` alongside
  `companyId`) or an equivalent canonical label source.

---

## Appendix: Open items deferred from this investigation

Two follow-up items are deferred beyond the pre-implementation gate:

- **Phase 37 candidate — searchable entity input adoption:** broaden the P36-B shared company-entry
  combobox to other entity selectors, starting with AccessTab user search.
- **Phase 37 candidate — legacy storage-key audit:** audit pre-existing admin/media localStorage
  keys that remain globally scoped after P36-A.

- **P36-A key convention locked:** `wpsg_view_<rootId>_<feature>` using a universal root-id helper
  plus `RootIdContext`.
- **P36-B companies source locked:** existing `/companies` endpoint; add frontend exhaustive fetch,
  shared company-entry control, and explicit new-company `{ name, slug }` contract.
