# Embedded Media Security Plan

This document defines how external media links (YouTube, Vimeo, Rumble, BitChute, Odysee) are handled securely in WP Super Gallery.

---

## Goals

- Prevent unsafe embeds and script injection.
- Allow only approved providers and URL patterns.
- Ensure embeds render in a controlled and predictable way.
- Support both WordPress and standalone SPA environments.

---

## Selected Approach

**Primary approach:** Server‑side URL validation + provider allow‑list + canonical embed URL construction.

**Rationale:**

- Keeps untrusted HTML out of the client.
- Avoids raw embed HTML coming from users.
- Produces consistent embed URLs and sandbox settings.
- Works in WordPress REST and in a standalone API.

We will **not** accept arbitrary embed HTML. We only accept raw URLs from known providers and transform them into safe embed URLs.

---

## Provider Allow‑List

Supported providers and canonical embed patterns:

- **YouTube**
  - Accept: `https://www.youtube.com/watch?v=...`, `https://youtu.be/...`
  - Embed: `https://www.youtube.com/embed/{id}`

- **Vimeo**
  - Accept: `https://vimeo.com/{id}`
  - Embed: `https://player.vimeo.com/video/{id}`

- **Rumble**
  - Accept: `https://rumble.com/{slug}`
  - Embed: `https://rumble.com/embed/{id or slug}`

- **BitChute**
  - Accept: `https://www.bitchute.com/video/{id}/`
  - Embed: `https://www.bitchute.com/embed/{id}/`

- **Odysee**
  - Accept: `https://odysee.com/@channel:hash/slug:hash`
  - Embed: `https://odysee.com/$/embed/{slug:hash}`

If a URL does not match the provider allow‑list or expected pattern, it is rejected.

---

## Validation Rules

- Enforce HTTPS only.
- Accept only allowed hostnames (exact match, no wildcards).
- Extract provider‑specific IDs using strict regex patterns.
- Reject unknown providers or malformed URLs.
- Store both the original URL and the canonical embed URL.

---

## Rendering Rules (Client)

- The client renders **only** the canonical embed URL.
- Use a strict `iframe` with fixed `allow` attributes:
  - `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"`
- No inline HTML injection, no `dangerouslySetInnerHTML`.

---

## WordPress Implementation Notes

- For CPT media fields, store:
  - `source = external`
  - `provider`
  - `url` (original)
  - `embedUrl` (canonical)

- Validation happens in REST endpoint callbacks (server‑side).
- If WordPress oEmbed is used, it must be treated as **secondary** and still validated by the allow‑list before rendering.

---

## Standalone API Implementation Notes

- The same validation logic should be used server‑side.
- Provide a single utility to normalize URLs and generate `embedUrl`.

---

## Security Risks & Mitigations

- **XSS via HTML embed:** Mitigated by rejecting HTML and only allowing URLs.
- **Clickjacking or UI redress:** Use consistent iframe sandbox or allow rules.
- **Provider spoofing:** Mitigated by strict hostname allow‑list and regex validation.

---

## Future Enhancements

- Add provider‑specific oEmbed resolution as a fallback only after validation.
- Add an external object store for uploaded media if needed.

Document created: January 21, 2026.

