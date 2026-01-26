# Admin Panel Plan

This document breaks down the admin panel scope for campaign creation, media management, and user access control.

---

## Goals

- Create and manage campaigns (cards).
- Attach media via upload or external links (YouTube/Vimeo).
- Manage user access to campaigns.
- Provide clear auditability for changes.

---

## Core Features

### Campaign Management

- Create, edit, and archive campaigns.
- Assign company branding (name, logo, color).
- Define visibility (public/private).
- Reorder and sort campaigns.

### Media Management

- Upload images and videos (if self‑hosted).
- Add external embeds (YouTube, Vimeo, etc.).
- Order media items per campaign.
- Thumbnail + caption management.

### User Access

- Assign users to campaigns.
- Role‑based access (viewer/admin).
- Bulk access updates.
- Access audit trail.

---

## Data Model Extensions

- Campaign status: active | archived | draft.
- Media source: upload | external.
- Access table: user_id, campaign_id, role, granted_at.

---

## UI Sections

1. **Campaign List**
   - Search, filter by company, status.

2. **Campaign Editor**
   - Title, description, tags, company info.

3. **Media Manager**
   - Uploads, embed links, ordering.

4. **User Access Manager**
   - Assign and revoke access.

---

## Security & Audit

- Admin‑only routes guarded at API and UI levels.
- Audit log for admin actions (create/update/delete).

Document created: January 17, 2026.
