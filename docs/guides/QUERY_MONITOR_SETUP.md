# Query Monitor Setup (Phase 8)

This guide explains how to enable query profiling using the Query Monitor plugin.

---

## Install
1. Install the **Query Monitor** plugin from the WordPress plugin directory.
2. Activate it in WP Admin.

---

## Usage

- Open any page that loads the gallery or the admin panel.
- Click the Query Monitor toolbar item in the WP admin bar.
- Review:
  - **Queries**: total count and duration
  - **Slow Queries**: anything > 50ms
  - **REST API**: time spent in REST callbacks

---

## Focus Areas for WP Super Gallery

- `/wp-json/wp-super-gallery/v1/campaigns`
- `/wp-json/wp-super-gallery/v1/companies/{id}/access?include_campaigns=true`
- `/wp-json/wp-super-gallery/v1/campaigns/{id}/media`

---

## Success Criteria

- No repeated per‑campaign `postmeta` queries for access grants.
- Most REST queries < 50ms on typical content sizes.
- Query count stable across repeated requests (cached responses should reduce DB usage).
