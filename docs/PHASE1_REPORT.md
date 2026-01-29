# Phase 1 Report

This document summarizes Phase 1 work (Core Data + API Contract) and outlines how the app supports both WordPress plugin embedding and standalone SPA usage.

---

## Phase 1 Summary (What was done)

### 1) Architecture + API Contract

- Finalized Phase 1 system of record: WordPress CPT + REST API.
- Defined API contract for campaigns, media, access, and uploads.
- Added endpoint shapes and payload examples.

See: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### 2) Embed Security

- Documented secure handling of external media (allow‑list + canonical embed URLs).
- Enforced HTTPS and provider-specific URL validation.

See: [docs/EMBED_SECURITY.md](docs/EMBED_SECURITY.md)

### 3) WordPress Plugin Skeleton (CPT + REST)

- CPT: `wpsg_campaign`
- Taxonomy: `wpsg_company`
- Meta fields: visibility, status, cover image, tags, media items, access grants/overrides
- REST routes implemented for campaigns, media, access, and uploads

Files:

- [wp-plugin/wp-super-gallery/wp-super-gallery.php](wp-plugin/wp-super-gallery/wp-super-gallery.php)
- [wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php](wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php)
- [wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php](wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php)

### 4) Embed Wrapper + Asset Handling

- Shortcode: `[super-gallery]`
- Supports compact layout via `compact="true"`
- Manifest-based asset loading with fallback to default bundle

File:

- [wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php](wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php)

### 5) SPA + WP Dual Mount

- Supports both standalone SPA and WordPress embed.
- Dual mount strategy:
  - If `#root` exists → SPA mode.
  - Else, mount into each `.wp-super-gallery` node → WP mode.
- Shadow DOM is used for isolation in both modes.

File:

- [src/main.tsx](src/main.tsx)

---

## Flexibility: WP Plugin vs Independent SPA

### WordPress Plugin Mode

- WP shortcode outputs a container with props in `data-wpsg-props`.
- App mounts into `.wp-super-gallery` containers.
- Shadow DOM isolates styles from WordPress themes.
- REST endpoints live under `/wp-json/wp-super-gallery/v1`.

### Standalone SPA Mode

- App mounts to `#root` if present.
- Same React build works without WordPress.
- Shadow DOM remains enabled (toggleable via URL flag if needed).

---

## Local Run Plan (WP + SPA)

### A) Standalone SPA

1. Install dependencies:
   - `npm install`
2. Run dev server:
   - `npm run dev`
3. Open:
   - `http://localhost:5173`

### B) WordPress Plugin (local)

#### Option 1: Local WordPress with plugin folder (recommended)

1. Create a local WordPress install (e.g., via LocalWP, XAMPP, or Docker).
2. Copy the plugin folder:
   - `wp-plugin/wp-super-gallery` → `wp-content/plugins/wp-super-gallery`
3. Activate the plugin in WP Admin.
4. Create a page and add shortcode:
   - `[super-gallery]`
5. Build the SPA into the plugin assets folder:
   - `npm run build:wp`
   - This copies `dist/` into the plugin assets folder for you.
6. Visit the page and verify the gallery renders.

#### Option 2: SPA dev + WP data (advanced)

- Run `npm run dev` and configure the SPA to point to the WP REST API.
- This is useful for faster iteration, but requires CORS and auth setup.

---

## Notes

- Phase 2 will focus on authentication and permission enforcement.
- Admin panel CRUD and media management will leverage the Phase 1 REST endpoints.

Document created: January 21, 2026.

