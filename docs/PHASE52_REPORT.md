# Phase 52 - Admin Platform Features & RBAC Enforcement Audit

**Status:** Planning
**Created:** 2026-06-14
**Last updated:** 2026-06-14

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P52-A | RBAC audit & boundary enforcement — verify and enforce reader/editor/admin boundaries, especially WP Dashboard access and per-space scoping | To do | Medium-High |
| P52-B | Asset Management — global (non-campaign) asset add/delete in WP admin, mirrored into the app Admin Panel | To do | Medium-High |
| P52-C | Campaign tags/categories overhaul — show tags+categories in the listing, "Add Campaign" modal, multi-select tag/category entry with removable badges | To do | Medium |
| P52-D | Service Worker offline app-shell — versioned shell cache + deploy-time busting + offline fallback (promoted from FUTURE_TASKS) | To do | Medium |

---

## Rationale

Phase 52 collects the **larger, net-new features and the security audit** that were split out of the Phase 51 issue batch (Phase 51 kept the small, ship-now fixes — see PHASE51_REPORT.md, group P51-E…H). These items share a theme: they extend the admin/platform surface (asset management, campaign metadata UX) or harden it (RBAC enforcement), and each is big enough to warrant its own track rather than riding along as a quick fix.

Success: role boundaries are provably enforced server-side; admins can manage global assets from both the WP sidebar and the in-app Admin Panel using the same workflow; campaign tags/categories are first-class in listing and creation; and the gallery degrades gracefully offline.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Where Asset Management UI lives | Build the asset CRUD UI as a shared component and surface it in **both** the WP admin (new "SuperGallery" submenu) and the app Admin Panel. The Admin Panel host shape (new tab vs. Media-tab subtabs) is an open decision — see P52-B. |
| B | Update path for grant role edits | Reuse the existing `upsert_grant()` POST endpoints (no new PATCH route) — already decided for the P51-H quick win; P52-A's audit confirms these paths enforce the right caps. |
| C | SearchableEntityInput multi-select | Extend with removable badges OR add a thin `MultiEntityInput` wrapper over Mantine `Combobox`, to avoid breaking existing single-select callers. Decide in P52-C. |

## Execution Priority

1. **P52-A** first — it is a correctness/security audit; its findings may constrain how P52-B (asset endpoints) and any admin surface are gated.
2. **P52-B** — depends on the P51-G menu rename (the new "SuperGallery" parent menu) and on P52-A's permission conclusions.
3. **P52-C** — self-contained React/REST work; data + endpoints already exist.
4. **P52-D** — independent; can land any time after P50-F (shipped).

---

## Track P52-A - RBAC audit & boundary enforcement

### Problem

The app has three access tiers — **reader** (view-only of permitted spaces), **editor** (in-app Admin Panel for permitted spaces only, no WP Dashboard), and **admin** (WP Dashboard + all spaces). We need to audit that these boundaries are enforced *server-side everywhere it matters* — particularly that editors/readers cannot reach the WP Dashboard or spaces they were not granted. Builds on prior RBAC work (`docs/PHASE33_REPORT.md`, `tests/WPSG_P33C_Role_Enforcement_Test.php`).

Key surfaces to audit:
- **Capability/role definitions:** `wp-plugin/wp-super-gallery/wp-super-gallery.php` (~lines 80–116: `manage_wpsg` cap, `wpsg_admin` role); CPT caps in `includes/class-wpsg-cpt.php` (~lines 14–25, `CPT_CAPS`, `map_meta_cap`).
- **Dashboard gating:** admin menu pages guarded by `manage_wpsg` / `manage_options` (`class-wpsg-space-admin-renderer.php` ~line 34; `class-wpsg-settings-renderer.php` ~line 47).
- **REST enforcement:** `includes/rest/class-wpsg-rest-base.php` (`require_admin` ~line 224, `require_campaign_editor`, `require_campaign_owner`); per-space/per-campaign grant resolution from post meta `access_grants` + `wpsg_company` term meta (`class-wpsg-access-controller.php`).

### Fix

- Produce an **audit matrix**: capability × screen/REST endpoint × expected tier, and walk every REST permission callback against it.
- Confirm space scoping is enforced in the permission callback (server-side), not merely hidden in the React UI.
- Close any gap found, and extend the P33 role-enforcement test suite with regression tests for each boundary (reader cannot mutate, editor cannot reach WP Dashboard or non-granted spaces, only admin gets cross-space + Dashboard).

### Acceptance criteria

- A documented matrix of tier × surface with pass/fail noted.
- Every identified gap is fixed, with a regression test that fails before and passes after.
- Editors and readers provably cannot load any WP-admin screen or call any admin-gated REST endpoint.

### Validation

- New/extended PHPUnit role-enforcement tests (alongside `WPSG_P33C_Role_Enforcement_Test.php`).
- Manual QA: log in as each tier, attempt to reach WP Dashboard and a non-granted space.

## Track P52-B - Asset Management (global, non-campaign assets)

### Problem

Admins need an intuitive place to add/delete the plugin's **global asset images** (the overlay/graphic-layer library, and optionally fonts) — both in the WP sidebar and in the app's Admin Panel. Today there is no dedicated management surface; assets are created incidentally via uploaders.

Existing infrastructure to reuse (no new storage):
- `includes/class-wpsg-asset-library.php` — `get_all()`, `add()`, `set_universal()`, `set_tags()`, `remove()`, `handle_upload()`; custom table `{prefix}wpsg_assets`.
- `includes/class-wpsg-font-library.php` — parallel pattern for fonts (optional second tab).
- Admin permission gate `require_admin()` (`manage_wpsg`).

### Fix

Build asset CRUD once and surface it in two hosts, the **same way** in both:

1. **WP admin** — a new submenu under the renamed "SuperGallery" menu (P51-G), rendering the asset manager.
2. **App Admin Panel** — mirror the *exact same* management UX so assets can be managed in either place identically.

**Open decision — Admin Panel host shape (call out and resolve when scoping this track):** the user wants non-campaign asset management to mirror cleanly into the Admin Panel. Two candidate shapes:
- **(i) A new dedicated Admin Panel tab** for non-campaign / global assets, sitting beside the existing tabs.
- **(ii) Subtabs inside the existing Media tab** — split it into "Campaign" (existing media management) and "Non-campaign / Global" (the new asset management).

Choose the option that makes the WP-admin and Admin-Panel experiences easiest to keep identical. Prefer extracting the asset-manager UI into a shared component consumed by both hosts (and by whichever Admin Panel shape wins) so the two surfaces cannot drift. Reference the existing Media tab (`src/components/Admin/MediaTab.tsx`, lazy-loaded in `AdminPanel.tsx`) for the campaign-media pattern to mirror. Add a REST controller extending `WPSG_REST_Base` only if endpoints beyond the existing library routes are needed.

### Acceptance criteria

- Admins can add and delete global assets from the WP sidebar **and** the app Admin Panel, with the same controls and behavior in both.
- The asset-management UI is a single shared component (no duplicated implementation between hosts).
- The Admin Panel host shape (new tab vs. Media subtabs) is decided and documented in this track before implementation.
- Non-admins cannot reach the asset-management surface or its endpoints.

### Validation

- Component/integration tests for the shared asset manager.
- Manual QA: add/delete an asset in WP admin, confirm it appears/disappears in the Admin Panel view and vice versa.

## Track P52-C - Campaign tags/categories overhaul

### Problem

Tags and categories are not first-class in the campaign listing or creation flow. The listing table (`src/components/Admin/CampaignsTab.tsx`, cols ~lines 88–93: Title/Status/Visibility/Company/Grants/Actions) shows neither. In the create/edit modal (`src/components/Campaign/UnifiedCampaignModal.tsx`), tags are a comma-separated text input (~lines 288–294) and categories a `MultiSelect` (~lines 295–304) — inconsistent and clumsy for many values. The user also wants the "Add Campaign" action surfaced as a clear button opening the modal.

Data + endpoints already exist (`src/services/api/campaignsApi.ts`): tags `GET/POST/DELETE /v1/tags/campaign` (`TagEntry`), categories `GET/POST/PUT/DELETE /v1/campaign-categories` (`CampaignCategoryEntry`, hierarchical); hooks `useCampaignTags` / `useCampaignCategories` (`src/services/adminQuery.ts`).

### Fix

- **Listing:** add Tags and Categories columns to `CampaignsTab.tsx` / `useCampaignsRows.tsx`, rendered as wrapping badge lists that handle many values gracefully.
- **Add Campaign:** surface a clear "Add Campaign" button that opens the existing `UnifiedCampaignModal` (`useUnifiedCampaignModal`).
- **Creation entry:** replace the comma-separated tag input with a multi-select searchable entry that shows selected items as removable badges (name + ×); align the categories control to the same removable-badge display.
- **`SearchableEntityInput` multi-select:** `src/components/Common/SearchableEntityInput.tsx` is single-select today (`onOptionSubmit(value)`, single clear). Extend it to support multiple selections as removable Mantine `Pill`/`Badge` chips, **or** add a thin `MultiEntityInput` wrapper over Mantine `Combobox` to avoid breaking existing single-select callers (`AccessTab.tsx`, `CompanyCombobox.tsx`).

### Acceptance criteria

- Campaign listing shows tags and categories per row, wrapping cleanly for many values.
- "Add Campaign" is a visible button that opens the campaign modal.
- During creation/edit, tags and categories are each added via search, displayed as badges with an obvious × to remove, and persisted via the existing endpoints.
- Existing single-select `SearchableEntityInput` callers are unaffected.

### Validation

- Component tests for the multi-select input (add/remove badges) and the listing columns.
- Manual QA: create a campaign with several tags and categories; confirm they persist and render in the listing.

## Track P52-D - Service Worker offline app-shell

### Problem

Promoted from `docs/FUTURE_TASKS.md` (Build & Bundle; P50-F follow-on). Going offline and reloading produces `ERR_INTERNET_DISCONNECTED` because the SW intentionally skips navigation/HTML caching (`request.mode === 'navigate'` bail in `public/sw.js`) to avoid stale-chunk failures after deploys. The metadata SWR cache (`wpsg-meta-v1`) survives offline but has no page to serve into.

### Fix

- A **versioned app-shell cache** for the gallery entry-point HTML, tied to the deployed bundle (version hash injected at build time, or `workbox-window` + `injectManifest`).
- **Deploy-time cache busting** so the shell is invalidated on every deploy and imports the correct Vite chunk URLs.
- An **offline fallback** — a minimal branded page when the shell is absent/too stale, instead of the browser error screen.

Open questions (carried from FUTURE_TASKS): (Q1) how the deploy version reaches the SW — build-time hash injection vs. a `/__wpsg_version` PHP endpoint vs. `workbox-window` + `injectManifest`; (Q2) whether the SW must handle multiple WP page URLs embedding the shortcode or only the site root; (Q3) static offline HTML string in the SW vs. a separately cached `offline.html`.

### Acceptance criteria

- Reloading offline serves a working app shell (or a branded offline fallback), not the browser error page.
- A new deploy invalidates the stale shell without manual site-data clearing.

### Validation

- Manual QA in DevTools offline mode: reload and confirm the shell/fallback renders; deploy a new bundle and confirm the shell updates.

## Follow-On Candidates

`docs/FUTURE_TASKS.md` items evaluated and intentionally left deferred:

| Candidate | Why it is deferred |
|-----------|--------------------|
| JWT in-memory token auth + frontend silent refresh | Blocked on the standalone-SPA scenario and the CORS allow-list; no value for the primary same-origin shortcode deployment. |
| CORS origin allow-list & admin UI | Same — meaningful only for standalone cross-origin SPA deployments. |
| Third-party OAuth providers | High effort, unresolved design questions (popup vs. redirect when embedded), priority unclear. |
| GraphQL API alternative | High effort, ROI unproven without a concrete external-integrator use case. |
| Settings panel animation variants | Low-impact polish; fold in opportunistically. |
| SettingsPanel space-badge dark-mode parity | Cosmetic; badge is already nearly correct. |
| Timeline / variable-aspect-ratio grid adapters | Net-new adapters, no current demand; revisit after P51-E stabilizes the adapter geometry helper. |
| Campaign binary export streaming (>100 MB) | Low impact; current 100 MB ceiling covers most campaigns. |

## Implementation Notes

- Record completed work here as tracks land.

## Outcome

_Pending — phase in planning._
