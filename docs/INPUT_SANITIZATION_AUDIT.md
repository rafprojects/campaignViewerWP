# Input Sanitization Audit (Phase 8)

This document summarizes the input sanitization checks for WP Super Gallery REST endpoints.

---

## Scope

- Public and admin REST endpoints in `WPSG_REST`
- Frontend settings submission
- Upload handling (file validation already covered separately)

---

## Key Protections in Place

- **Text fields:** `sanitize_text_field()` for titles, captions, roles, sources, actions
- **URLs:** `esc_url_raw()` for external URLs and thumbnails
- **Email:** `sanitize_email()` and `is_email()` validation
- **Integers:** `intval()` / `absint()` for IDs and numeric fields
- **Booleans:** explicit `(bool)` casts for flags
- **Lists/arrays:** filtered and normalized (`access_grants`, `access_overrides`, `media_items`)

---

## Endpoint Highlights

- `POST /campaigns` uses `sanitize_text_field` and `wp_kses_post` for description.
- `PUT /campaigns/{id}` sanitizes title and description on update.
- `POST /campaigns/{id}/media` validates type/source, normalizes URLs, and sanitizes captions.
- `PUT /campaigns/{id}/media/{mediaId}` sanitizes caption/order/thumbnail.
- `POST /users` sanitizes email, display name, role, and campaign ID.
- `POST /settings` sanitizes all settings and re‑uses `WPSG_Settings::sanitize_settings`.

---

## Gaps / Notes

- Public oEmbed endpoint sanitizes URL and SSRF checks are enforced.
- Access grants use `userId` integer validation and `source/action` allowlists.
- If new fields are added, ensure the same sanitization patterns are followed.

---

## Verification Checklist

- Submit invalid data (e.g., script tags in captions) and verify sanitized output.
- Attempt invalid roles, sources, or actions and confirm 400 responses.
- Confirm URL fields are normalized and reject non‑HTTPS for oEmbed.
