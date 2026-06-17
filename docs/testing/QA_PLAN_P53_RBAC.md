# P53 RBAC — QA Plan

> **Version:** 1.1
> **Last Updated:** 2026-06-16
> **Scope:** Phase 53 tracks A–D — RBAC model alignment, editor-tier surfacing, grant simplification

---

## Overview

Phase 53 delivers two major changes:

1. **Role model** (P53-B/C/D) — public campaigns are visible to everyone; per-grant editor/owner levels are removed (viewer-only grants); the `wpsg_editor` role (`manage_wpsg`) is now the canonical editing credential, not a grant level.
2. **Frontend tier surfacing** (P53-A) — the React app now distinguishes `wpsg_editor` from `administrator`. Editors get a scoped Admin Panel; system-admin-only controls are hidden. The app also prevents firing 403-bound queries for editors, and layout-template deletes escalate through a force-confirm when the template is in use.

### Access model at a glance

| | System Admin (`administrator`) | Editor (`wpsg_editor`) | Viewer |
|---|---|---|---|
| `/wp-admin` | ✅ | ✗ — redirected to homepage | ✗ |
| Admin Panel + Settings | ✅ full | ✅ scoped to explicitly granted spaces | ✗ |
| Open-mode spaces | ✅ implicit (system admin sees all) | ✗ — explicit grant required | ✗ |
| Delegated spaces | ✅ implicit (system admin sees all) | ✗ — explicit grant required | ✗ |
| Entry point | WP Admin sidebar | **Floating button on any frontend page with a gallery** | n/a |

Editors never use `/wp-admin` — any attempt is redirected to the homepage by the plugin. Their entry point is the floating Admin Panel button on frontend gallery pages. The Admin Panel is then scoped to the spaces the editor has been explicitly granted access to. **Spaces in "open" isolation mode are not a backdoor** — editors need an explicit grant even for open-mode spaces.

This plan is organized around two test **personas** tested in parallel browser sessions.

---

## 1. Setup

### 1.1 Personas required

| Persona | WP Role | Space access |
|---|---|---|
| **System Admin** | `administrator` | All spaces (no grant needed) |
| **Editor** | `Gallery Editor` (`wpsg_editor`) | Granted to **Space A only** |

### 1.2 Creating the Editor user

The `wpsg_editor` role is registered as **"Gallery Editor"** in WordPress. There is no custom Roles management page in the plugin UI — use the standard WP user screen.

1. WP Admin → **Users → Add New**
2. Fill in username/email/password
3. Set **Role** to **Gallery Editor**
4. Click **Add New User**

> **Common mistake:** WordPress has a built-in **"Editor"** role (for post editing). That is not the same as **"Gallery Editor"** (`wpsg_editor`). Assigning the wrong role means the user gets no Admin Panel access. Double-check the role dropdown.

### 1.3 Granting space access to the Editor

Space grants are managed inside the app (not in WP Admin).

1. Log in as System Admin, open the **Super Gallery app** (Admin Panel)
2. Navigate to **Spaces** (or the Spaces tab if in the space management view)
3. Select **Space A**
4. Open its **Access** tab
5. Grant the Editor user viewer access to Space A
6. Leave **Space B** ungranted

> **Important:** Editors require an explicit space grant regardless of the space's isolation mode. An "open" space is **not** automatically accessible to editors — open mode only affects system-admin implicit access. If an editor can see campaigns in a space they were not explicitly granted, that is a bug.

### 1.4 Fixture data required

Before starting, confirm the following exist. Create them if not:

| Fixture | Purpose |
|---|---|
| **Space A** with ≥ 1 private campaign | Editor should see these |
| **Space B** with ≥ 1 private campaign | Editor should NOT see these |
| **Space B** with ≥ 1 public campaign | Editor SHOULD see these (P53-B) |
| A page with galleries from both Space A and Space B embedded | Page-spaces scoping check |
| A layout template **in use by ≥ 1 campaign** | Force-delete escalation check |
| A layout template **not in use** | Normal delete (no escalation) |

---

## 2. Automated Tests (run before manual QA)

These must pass before proceeding to manual steps.

### 2.1 Frontend — Vitest

```bash
npx vitest run
```

**Pass criteria:** 0 failures. Relevant test files:

| File | Covers |
|---|---|
| `src/services/auth/WpNonceProvider.test.ts` | `resolveRole` — isAdmin+isSystemAdmin → role string |
| `src/services/auth/WpJwtProvider.test.ts` | `resolveRole` in JWT path |
| `src/contexts/AuthContext.test.tsx` | `isAdmin` / `isSystemAdmin` derivation from `user.role` |
| `src/components/Admin/AdminPanel.test.tsx` | Editor gating: system-audit tab hidden, gated queries disabled |
| `src/components/Admin/AccessTab.test.tsx` | Company/All segments hidden for non-system-admin |
| `src/components/Admin/AnalyticsDashboard.test.tsx` | All-campaign summary not fetched for editors |
| `src/components/Admin/FontLibraryManager.test.tsx` | Delete button hidden for non-system-admin |
| `src/components/Admin/SpaceManagementView.test.tsx` | Create-space form hidden for editors |
| `src/components/Admin/SettingsPanel.test.tsx` | Integrations/System & Admin tabs hidden for editors |
| `src/components/Admin/LayoutTemplateList.test.tsx` | 409 → force-confirm → resend with `force=true` |

### 2.2 Backend — PHPUnit

```bash
cd wp-plugin/wp-super-gallery
./vendor/bin/phpunit
```

**Pass criteria:** 0 failures. Key test files added in P53:

| File | Covers |
|---|---|
| `tests/WPSG_P53A_Tier_Signal_Test.php` | `/permissions` returns correct isAdmin/isSystemAdmin per role |
| `tests/WPSG_P53A_Scoping_Test.php` | Campaign list and page-spaces scoped correctly per role |
| `tests/WPSG_P53D_Grant_Model_Test.php` | Viewer-only grants; editor in accessible vs. inaccessible spaces |
| `tests/WPSG_Public_Visibility_Test.php` | Public campaigns visible to logged-in users (P53-B) |
| `tests/WPSG_Cookie_Auth_Test.php` | Login response includes isSystemAdmin + correct role string |

---

## 3. Manual QA — Login Payload (DevTools, ~2 min)

Verify the backend is sending the right tier signal before testing the UI.

**Steps:**
1. Open DevTools → Network tab
2. Log in as **Editor** → watch for the `auth/cookie` POST response
3. Log in as **System Admin** → same

**Expected payloads:**

| Field | Editor | System Admin |
|---|---|---|
| `isAdmin` | `true` | `true` |
| `isSystemAdmin` | `false` | `true` |
| `role` | `"editor"` | `"admin"` |

Also check `GET /wp-super-gallery/v1/permissions` (fires on load for nonce-based auth):

| Field | Editor | System Admin |
|---|---|---|
| `isAdmin` | `true` | `true` |
| `isSystemAdmin` | `false` | `true` |

---

## 4. Manual QA — Editor Persona (~15 min)

Log in as the **Editor** user for all checks in this section.

### 4.1 Admin Panel access and `/wp-admin` redirect

- [ ] Visiting `https://your-site/wp-admin/` while logged in as the Editor **redirects to the homepage** — no WP dashboard is shown
- [ ] Admin Panel (floating button on a gallery page) opens without a 403 error
- [ ] Campaigns tab is present and functional

### 4.2 System-admin-only surfaces are hidden (A-3)

| Surface | Expected for Editor |
|---|---|
| Campaigns — **Import** button (top-right) | Hidden |
| Campaigns — Import option in mobile hamburger menu | Hidden |
| Media tab — **Export ZIP** button | Hidden |
| Media tab — **Import ZIP** button | Hidden |
| Media tab — **Rescan All** button | Hidden |
| **System Audit** tab | Hidden / not in tab list |
| Access tab — **View By** control (Company / All segments) | Hidden; only Campaign view shown |
| Analytics tab — all-campaign StatCards (total views, etc.) | Hidden |
| Analytics tab — **Top Campaigns** section | Hidden |
| Space management — **Create new space** form | Hidden |
| Settings — **Integrations** tab | Hidden |
| Settings — **System & Admin** tab | Hidden |
| Font Library — **Delete** (trash) button on each font | Hidden |

### 4.3 Campaign list is scoped (A-4)

- [ ] Private campaigns in **Space A** (explicitly granted) are visible
- [ ] Private campaigns in **Space B** (no grant) are **absent** — this applies whether Space B is open-mode or delegated-mode
- [ ] Public campaigns in **Space B** are visible (P53-B cross-space visibility preserved)

### 4.4 Page-spaces / admin bar scoping (A-4)

Navigate to the frontend page with galleries from both Space A and Space B.

- [ ] The admin bar / space switcher shows **only Space A**
- [ ] Space B does not appear in the switcher — regardless of its isolation mode

### 4.5 Editing still works in accessible space (sanity check)

- [ ] Open a campaign in Space A → edit title / settings → save → changes persist
- [ ] Per-campaign analytics chart loads (not blocked)

### 4.6 No spurious 403 errors in the console

Open DevTools Console/Network while browsing as Editor.

- [ ] No 403 errors on `analytics/summary`, `access-summary`, or `audit-log` endpoints
- [ ] No unhandled error notifications appear on page load

---

## 5. Manual QA — System Admin Persona (~10 min)

Log in as **administrator** for all checks in this section. These verify that gating doesn't over-reach.

### 5.1 All system-admin surfaces are present

| Surface | Expected for System Admin |
|---|---|
| Campaigns — **Import** button | Visible |
| Media tab — Export / Import ZIP / Rescan All | Visible |
| **System Audit** tab | Visible and loads entries |
| Access tab — **View By** Company / All segments | Visible and functional |
| Analytics tab — all-campaign StatCards | Visible and populated |
| Analytics tab — Top Campaigns | Visible |
| Space management — **Create new space** form | Visible |
| Settings — **Integrations** tab | Visible |
| Settings — **System & Admin** tab | Visible |
| Font Library — **Delete** buttons | Visible |

### 5.2 Campaign list is unscoped

- [ ] Private campaigns in Space A visible
- [ ] Private campaigns in Space B visible
- [ ] All spaces appear in the admin bar / page-space switcher

---

## 6. Manual QA — Delete-Confirm Flow (A-5)

Can be done as either persona (both can manage layout templates). Recommended as System Admin for simplicity.

### 6.1 Normal delete (template not in use)

1. Go to **Layouts** tab → find a template that has **0 campaigns using it**
2. Open its actions menu → click **Delete**
3. A single confirmation modal appears
4. Click **Delete**
5. - [ ] Template is removed; success notification fires
6. - [ ] No second ("delete anyway") modal appears

### 6.2 Force-delete escalation (template in use)

1. Go to **Layouts** tab → find a template that is **in use by ≥ 1 campaign**
2. Open its actions menu → click **Delete**
3. First confirmation modal appears → click **Delete**
4. - [ ] First delete attempt fires (no `force` param)
5. - [ ] A **second modal** appears: `"[Template name]" is in use by N campaign(s). Deleting it will unbind those campaigns. Delete anyway?`
6. - [ ] No error notification shown at this point

**Cancel path:**
7. Click **Cancel** (or close the modal)
8. - [ ] Template is not deleted; list unchanged

**Confirm path (fresh attempt):**
7. Click **Delete anyway**
8. - [ ] Template is deleted; success notification fires
9. - [ ] Campaigns that used the template are unbound (open one and verify its layout template field is empty/unset)

---

## 7. Regression Checks (~5 min)

Quick smoke-tests to confirm P53 didn't break existing behavior.

- [ ] Public campaign is viewable by an **anonymous** visitor (no login)
- [ ] Public campaign is viewable by a **logged-in viewer** (subscriber, no gallery access grants)
- [ ] A viewer-grantee with access to a private campaign in Space B can view it
- [ ] A viewer-grantee with access to a private campaign in Space B **cannot** see any edit controls
- [ ] P47 space isolation still holds: a user with no grants to Space B cannot view Space B private campaigns

---

## 8. Notes

- **No "Super Gallery > Roles" page exists.** The `wpsg_editor` role is created programmatically by the plugin and appears as **"Gallery Editor"** in the standard WordPress Users screen. There is no plugin-provided UI for role management.
- **"Gallery Editor" ≠ WordPress "Editor".** WordPress ships a built-in "Editor" role for post management. Assigning the wrong one gives the user no Admin Panel access. Always verify the role in WP Admin → Users if the Admin Panel button is missing.
- **Open-mode spaces are not a backdoor for editors.** Prior to the post-QA fix (commit `676b72f4`), open-mode spaces implicitly granted access to any `manage_wpsg` user. This has been corrected: editors now need an explicit space grant regardless of isolation mode. Only system admins (`manage_options`) retain implicit access to open-mode spaces.
- **`/wp-admin` redirect.** Editors are actively redirected to the homepage if they attempt to access any `/wp-admin` URL. This is enforced server-side via `admin_init`; it is not merely a lack of menu items.
- **Editor role self-heals.** The plugin verifies on every WordPress init that the `wpsg_editor` role has the `manage_wpsg` capability, and repairs it if missing. If an editor's Admin Panel button disappears after a DB restore or WP role reset, a plugin deactivate/reactivate cycle or simply loading any page will trigger the repair.
- **Space grants → viewer-only (P53-D).** The Access tab grant flow now only offers viewer level. Existing editor/owner grants in stored data degrade gracefully to view-only; no migration needed.
- **Asset-library force-delete not yet wired.** The inline delete inside the Layout Builder modal shares the same 409 contract but the force-confirm UI has not been added there. This is a known future polish item. The `ApiError.data` plumbing is already in place.
