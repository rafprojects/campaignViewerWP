# Phase 53 - Frontend RBAC Surfacing & P52 Follow-ons

**Status:** Planned
**Created:** 2026-06-15
**Last updated:** 2026-06-15

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P53-A | Frontend RBAC tier surfacing — expose a System-Admin (`manage_options`) tier to the React app and gate AdminPanel system controls by tier; template/asset delete-confirm modals that handle the P52-A5c `409` → resend `force=true`. **Deferred from P52-A6.** | To do | Medium-High |

---

## Rationale

Phase 53 is the home for follow-on work split out of Phase 52 — chiefly the **frontend** counterpart to the P52-A RBAC redesign. P52-A (see [PHASE52_REPORT.md](PHASE52_REPORT.md) › Track P52-A) made the `manage_options` (System Admin) vs `manage_wpsg` (`wpsg_editor`, space-scoped) boundary **provably enforced server-side** — every protected REST action resolves through the centralized `WPSG_Permissions` map, asserted by a frozen matrix + completeness/no-bypass test, with F1 (provability) and F2 (delegated cross-space) closed. What remains is purely UX: the React app does not yet *reflect* that boundary, so an editor is still shown controls that will return `403`, and the new in-use delete guards return `409` with no client affordance to confirm/override.

Success: a space editor sees only the controls they can actually use; System-Admin-only surfaces are hidden (not merely 403-on-click); and template/asset deletes present a confirm step that can force past the in-use guard. No change to the server-side boundary — it is already complete.

## Track P53-A - Frontend RBAC tier surfacing (deferred from P52-A6)

### Problem

The boundary is enforced server-side but invisible to the frontend. Concretely:

- The React app has **no `manage_options` concept** — auth state exposes only `isAdmin` (= `manage_wpsg`), consumed across ~32 files. So the UI cannot distinguish a System Admin from a space editor.
- The AdminPanel (~960 lines across a large component tree) shows system-level controls (system settings keys, fonts delete, Spaces management, user creation, global audit log, webhooks, media library, binary import/export) to any `manage_wpsg` user, even though P52-A now `403`s an editor on all of them.
- P52-A5c added server-side in-use guards on layout-template and asset deletes that return `409` (`wpsg_template_in_use` / `wpsg_asset_in_use`, including an `inUse` count). There is no client modal to surface that conflict or to resend with `force=true`.

### Scope

1. **Surface the tier.** Add a System-Admin signal to `list_permissions` (`/permissions`) and the page-config JS (`WPSG_Embed::page_config_js`); thread it through the auth providers (`src/services/auth/*`) and types (e.g. `isSystemAdmin`). Server source of truth: `current_user_can('manage_options')`.
2. **Gate AdminPanel system controls by tier.** Hide/disable the System-Admin-only surfaces listed above for editors, with appropriate empty/explanatory states. Mirrors the server matrix in `WPSG_Permissions`.
3. **Delete-confirm modals.** For layout-template and asset deletes, catch the `409`, show an "in use by N — delete anyway?" modal, and resend with `force=true` on confirm. (The modal is UX; the server guard is the control.)

### Constraint

Any tier/permission-**management** UI (role assignment, future custom-role config) belongs in the WordPress "Super Gallery" admin sidebar (wp-admin), **not** the React app (user direction, 2026-06-15). In-app work here is limited to *reflecting* the tier and the delete-confirm flow.

### Acceptance criteria

- The app knows the caller's tier; no System-Admin-only control is rendered for a `wpsg_editor`.
- Template/asset delete surfaces the in-use conflict and can force past it; a non-in-use delete needs only a normal confirm.
- No regression to the server boundary (the P52-A suites stay green).

### Validation

- React/vitest component tests for the tier gating and the delete-confirm 409→force flow.
- Manual QA: log in as `wpsg_editor` vs administrator and confirm the AdminPanel surface differs as specified.

### Dependencies / notes

- Server foundation is complete (P52-A). This track is additive frontend work.
- The granular custom-role builder remains separately future-tasked (`docs/FUTURE_TASKS.md` › Access Control) and is **not** part of P53-A.

---

## Open items / candidates (not yet committed tracks)

- **`users/search` vs campaign/space-owner grant flow.** `GET /users/search` is `manage_wpsg`-gated, but campaign/space *owners* can be plain subscribers (granted `owner`) who lack `manage_wpsg`. Such an owner can grant access (`require_campaign_owner` / `require_space_owner`) but cannot use the global user search to find the grantee. The gap is latent today (the AdminPanel/grant UI is itself `isAdmin`-gated, so non-`manage_wpsg` owners don't currently reach it), and surfaces only once P53-A exposes tier-appropriate UI. Candidate fix: give the grant flow an owner-gated, *scoped* user resolver (mirroring `space.resolve_user`, which is `require_space_owner`) rather than loosening the global search. Pending decision — promote to a P53 track if we want owners to self-serve grants.
