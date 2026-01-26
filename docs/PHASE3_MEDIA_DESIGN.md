# Phase 3 — Media Tab Design

Purpose: define UI flows, REST payloads, acceptance criteria and implementation notes for the Admin Media tab (create/edit/upload/link media per campaign).

1) Overview
- Media lives per-campaign: `GET /campaigns/{id}/media`.
- Two add flows: Upload (WP Media Library via `POST /media/upload`) and External Link (YouTube/Vimeo/etc via `POST /campaigns/{id}/media`).
- Each MediaItem: `{ id, type, source, provider, url, embedUrl?, thumbnail, caption, order }`.

2) Primary UI Flows

- Add Media (modal or inline drawer)
  - Choose: Upload | External link
  - Upload: drag/drop or file picker. Show progress bar, preview (image/video), allow choose thumbnail from upload or generated frame.
  - External: paste URL, validate, fetch oEmbed (thumbnail + title), preview embed, allow override title/thumbnail.
  - On success: POST to backend and insert into campaign media list at end or specified position.

- Edit Media
  - Open inline edit form (caption, thumbnail override, type change if allowed).
  - Save calls `PUT /campaigns/{id}/media/{mediaId}`.

- Delete Media
  - Confirm modal -> `DELETE /campaigns/{id}/media/{mediaId}`. On success remove from UI.

- Reorder Media
  - Drag handle in list/grid. On drop, batch `PUT /campaigns/{id}/media` or `PUT` on each item with `order` field; use debounce and optimistic UI.

3) REST Contract Examples

- GET campaign media
  - GET /campaigns/{id}/media
  - Response: 200
  - Body: `[{id, type, source, provider, url, embedUrl, thumbnail, caption, order}]`

- Upload
  - POST /media/upload
  - FormData: `file`, `campaignId` (optional) or return attachment used to create MediaItem
  - Response: `{ attachmentId, url, thumbnail, mimeType }`
  - Then client calls `POST /campaigns/{id}/media` with `{ type:'image'|'video', source:'upload', provider:'wordpress', url, thumbnail, caption, order }`

- Add external
  - POST /campaigns/{id}/media
  - Body: `{ type, source:'external', provider, url, embedUrl?, thumbnail?, caption?, order }`
  - Response: created MediaItem

- Edit
  - PUT /campaigns/{id}/media/{mediaId}
  - Body: `{ caption?, thumbnail?, order? }`

- Delete
  - DELETE /campaigns/{id}/media/{mediaId}

4) Acceptance Criteria (minimal)
- Admin can upload image/video files and see progress and preview.
- Admin can add external URLs and see a preview (oEmbed) before saving.
- Thumbnails are auto-populated from upload or oEmbed; admin can override.
- Reordering persists and is reflected in viewer order.
- Private campaign visibility rules respected (media not visible to unauthorized users).
- Actions show success/failure UI feedback (notifications, inline errors).

5) UX / Wireframe Notes (components)
- `MediaTab` main layout: left = campaign media list (sortable grid/list), right = inspector/edit panel.
- Top bar: `Add Media` (primary) -> modal/drawer with steps (type selection -> details -> confirm).
- Each media tile: preview thumbnail, caption (editable inline), drag-handle, kebab menu (edit/delete/select as thumbnail).
- Upload component: use Mantine `Dropzone` (or simple input) + progress UI + preview + cancel.
- Preview for external: small embedded iframe or provider thumbnail + provider badge.

6) Implementation Notes (files)
- Frontend
  - `src/components/Admin/MediaTab.tsx` — main UI and list.
  - `src/components/Admin/MediaUpload.tsx` — upload UI + progress.
  - `src/api/media.ts` — helpers: `uploadFile`, `addMediaToCampaign`, `updateMedia`, `deleteMedia`, `getCampaignMedia`.
- Backend (WP plugin)
  - `POST /media/upload` -> uses WP media handlers, returns attachment info.
  - Ensure `POST /campaigns/{id}/media` supports `source:upload|external`.

7) Edge Cases & Notes
- Large video uploads: require server limits; show error on 413/timeout and suggest WP Media Library fallback.
- Thumbnail extraction for videos: server-side or rely on WP attachments/extracted frames.
- oEmbed failures: fallback to provider thumbnail heuristics or ask admin to provide thumbnail URL.
- Concurrency: guard reorder endpoints to avoid race conditions; accept client-provided `order` and server normalize.

8) Next Steps
- Implement `src/api/media.ts` helpers and `MediaTab` scaffold.
- Add E2E tests for upload, external add, edit, delete, and private visibility.

Document created: January 24, 2026.

