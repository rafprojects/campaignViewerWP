# Phase 33 — Access Governance & Per-Campaign RBAC

**Status:** Complete
**Created:** 2026-05-19
**Last updated:** 2026-05-22

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P33-A | RBAC data model, precedence rules, and migration boundary | ✅ Complete | Medium |
| P33-B | Campaign/company grant schema and REST role endpoints | ✅ Complete | Large |
| P33-C | Role-aware server-side enforcement across admin and viewer actions | ✅ Complete | Medium-Large |
| P33-D | Access management UI for assigning, editing, and surfacing roles | ✅ Complete | Medium |

---

## Rationale

1. The 2026-05-19 FUTURE_TASKS reconciliation showed that most of the earlier
   access-control backlog already shipped in Phase 28. The remaining material
   gap is not expiry or summary UX; it is governance depth.
2. Current auth/user types and access grants remain binary: `viewer | admin`
   for auth and allow/deny for campaign/company grants. That is insufficient
   for team-managed campaigns where editing and access management should diverge.
3. This work deserves its own phase because it touches data model, REST
   contract, admin UI, viewer/editor surfaces, and migration behavior.
4. The phase must define precedence between site-wide admin capability,
   company-level grants, campaign-level grants, and explicit revocation before
   any UI lands.
5. Builder and layout-template editing create the sharpest permission boundary.
   The first pass should default those actions to owner-only unless the contract
   proves a narrower editor scope is safe.
6. Success means admins can grant `viewer`, `editor`, and `owner` roles per
   campaign, server-side authorization enforces those roles consistently, and
   existing grants migrate predictably.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Whether RBAC should mutate WordPress roles | No. Use per-campaign/company access levels instead of changing site-wide WP roles. |
| B | How to store the first-pass role data | Prefer extending the existing grant record shape with an `access_level` field before introducing a dedicated table. |
| C | How site-wide admin capability interacts with campaign roles | `manage_wpsg` (or equivalent admin capability) always overrides per-campaign roles. |
| D | What the first-pass `editor` role may change | Keep Layout Builder and layout-template mutation owner-only until a tighter builder-specific permission contract exists. |
| E | What should be trusted for enforcement | Server-side role checks are authoritative; UI disabling is convenience only. |
| F | How company-level and campaign-level roles combine | Document explicit precedence and downgrade rules before any migration or UI changes ship. |

## Execution Priority

1. P33-A — Establish the data model and precedence contract first because every
   later track depends on it.
2. P33-B — Land backend storage and REST behavior once the permission matrix is
   stable.
3. P33-C — Enforce roles on mutation and admin paths before the UI treats them
   as real.
4. P33-D — Finish with assignment/editing UX once the backend contract is
   stable and enforced.

## Track P33-A — RBAC Data Model, Precedence Rules, and Migration Boundary

### Problem

Current access grants only model existence, not level. The auth layer still
exposes `viewer | admin`, and many mutation paths implicitly assume a binary
"admin can change everything, everyone else can only view" contract.

Without an explicit permission matrix and precedence model, any RBAC
implementation risks inconsistency between REST handlers, AccessTab, and
builder/admin surfaces.

### Fix

Define and document the grant schema, precedence rules, and migration boundary
before implementation begins.

### Implementation Details

- Evaluate extending current campaign/company grant entries with
  `access_level: viewer | editor | owner`.
- Define precedence between site-wide admin capability, company-level grants,
  campaign-level grants, and explicit overrides/revocations.
- Decide how legacy grants map on first read or migration. The safe default is
  usually `viewer` unless a stronger ownership signal already exists.
- Produce one action matrix that covers at least: read, edit campaign metadata,
  mutate media, manage access, and mutate layout/builder surfaces.

### Permission Matrix

| Action | viewer | editor | owner | manage_wpsg |
|--------|:------:|:------:|:-----:|:-----------:|
| Read campaign (public or granted) | ✅ | ✅ | ✅ | ✅ |
| Read campaign metadata (private) | ✅ | ✅ | ✅ | ✅ |
| Edit campaign metadata (title, description, tags, status, visibility) | ❌ | ✅ | ✅ | ✅ |
| Mutate campaign media (add, edit, delete, reorder) | ❌ | ✅ | ✅ | ✅ |
| Publish / unpublish / schedule | ❌ | ✅ | ✅ | ✅ |
| Duplicate campaign | ❌ | ✅ | ✅ | ✅ |
| Manage campaign access (grant / revoke / approve requests) | ❌ | ❌ | ✅ | ✅ |
| Mutate layout template (builder save, slot edit) | ❌ | ❌ | ✅ | ✅ |
| Assign / change layout template binding | ❌ | ❌ | ✅ | ✅ |
| Archive / delete campaign | ❌ | ❌ | ✅ | ✅ |

> **Note:** `manage_wpsg` (site-wide WordPress capability) always overrides
> every campaign role. The check order is: `manage_wpsg` → `owner` → `editor`
> → `viewer`.

### Precedence Rules

1. **Site-wide admin wins.** Any user holding the `manage_wpsg` capability has
   unrestricted access to every campaign regardless of their campaign role.
2. **Campaign grant overrides company grant.** When a user has both a
   company-level grant and a campaign-level grant, the campaign grant's
   `access_level` is authoritative for that campaign.
3. **Company grant propagates as-is.** Where only a company grant exists, its
   `access_level` applies to every campaign in the company.
4. **Explicit deny beats all grants.** A campaign-level override with
   `action: deny` removes all access for that user on that campaign regardless
   of company or campaign grants.
5. **No role → no mutation.** A user who can see a campaign through a public
   or granted route but has no `access_level` grant is implicitly `viewer`.

### Data-Model Choice

Extend existing grant record arrays (`access_grants` post/term meta and the
access-requests table) with a single `access_level` field.  No new database
table is introduced in the first pass.

```
// Campaign grant entry shape (post_meta: access_grants)
{
  userId:       int,
  campaignId:   int,
  source:       'campaign' | 'company',
  grantedAt:    ISO 8601,
  expires_at:   ISO 8601 | null,
  access_level: 'viewer' | 'editor' | 'owner'   // P33-B addition
}
```

Company grant entries use the same shape with `companyId` in place of
`campaignId`.

### Migration Boundary

- **Legacy grants** (records without `access_level`) are read as `viewer`.
- No backfill migration is run on existing data; the default is applied at
  runtime on every read.
- Access-request approvals default to `viewer` unless the approving admin
  passes an explicit `access_level` in the approve payload.

### Acceptance criteria

- A written permission matrix exists for `viewer`, `editor`, and `owner`. (✅)
- The data-model choice and legacy-grant migration rule are documented. (✅)
- Company/campaign precedence and admin override behavior are documented. (✅)
- The phase can proceed without unresolved contract ambiguity around owner-only
  actions. (✅)

### Validation

- Review the matrix against the current auth model and grant shape.
- Cross-check proposed permissions against representative REST mutation routes
  and builder/admin surfaces.
- Record any unresolved scope items explicitly before P33-B starts.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `docs/PHASE33_REPORT.md` | Permission matrix, precedence, and migration boundary |
| `src/services/auth/AuthProvider.ts` | Current auth role constraints to be expanded later |
| `src/types/index.ts` | Current binary user/access types to be expanded later |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Current grant and auth behavior to align against |

### Effort Estimate

~2-4 hours.

---

## Track P33-B — Campaign/Company Grant Schema and REST Role Endpoints

### Problem

Once the contract is defined, the current grant storage and endpoints still
cannot persist or expose per-campaign access levels.

### Fix

Extend the grant payload shape and REST endpoints so campaign/company access can
store, return, and update role levels.

### Implementation Details

- Add `access_level` validation to campaign/company grant create/update flows.
- Expose role data on list/read endpoints and access-summary-style surfaces that
  need to display it.
- Preserve backward compatibility by treating legacy grant records with no
  `access_level` as the chosen migration default.
- Keep magic-link approval and access-request approval flows aligned with the
  new default role semantics rather than creating a second grant shape.

### Acceptance criteria

- Campaign and company access endpoints can read and write role levels. (✅)
- Legacy grants without `access_level` still behave predictably during the
  migration window. (✅)
- Access-request approval flows assign an explicit default role. (✅)
- REST coverage exists for role validation, legacy reads, and updated grant
  payloads. (✅)

### Validation

- Extend PHPUnit coverage around grant create/update/list flows.
- Add regression cases for legacy grant records without an `access_level`.
- Manual QA: create, edit, and revoke grants at both campaign and company
  scope.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Role-aware grant schemas and access endpoints |
| `wp-plugin/wp-super-gallery/tests/` | PHPUnit coverage for role-aware access flows |
| `src/services/apiClient.ts` | Updated access grant payloads and response types |
| `src/services/adminQuery.ts` | Query-layer typings for role-aware access data |

### Effort Estimate

~6-10 hours.

---

## Track P33-C — Role-Aware Server-Side Enforcement Across Admin and Viewer Actions

### Problem

New role data is meaningless if mutation routes and admin surfaces still rely
on the old binary admin check model.

### Fix

Introduce central role-aware authorization helpers and enforce them across the
campaign mutation paths that should honor `viewer`, `editor`, and `owner`.

### Implementation Details

- Centralize campaign-level permission checks so route handlers do not each
  re-encode RBAC logic ad hoc.
- Keep `viewer` read-only.
- Allow `editor` to mutate only the approved non-owner surfaces from the P33-A
  contract.
- Keep access-management and builder/layout-template mutations owner-only in
  the first pass.
- Preserve site-wide admin capability override behavior.

### Acceptance criteria

- `viewer` users can read but cannot mutate protected campaign/admin actions. (✅)
- `editor` users can perform the allowed mutation subset and are denied
  owner-only actions. (✅)
- `owner` users can manage access and other owner-scoped campaign actions. (✅)
- Site-wide admin capability still overrides campaign-level roles. (✅)

### Validation

- Add PHPUnit/integration coverage for representative allow/deny cases.
- Manual QA: verify campaign metadata/media mutation, access management, and
  owner-only surfaces all follow the documented matrix.
- Re-run representative admin and viewer regression paths after enforcement is
  in place.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Central role-aware permission checks and route enforcement |
| `wp-plugin/wp-super-gallery/tests/` | Allow/deny regression coverage |
| `src/components/Admin/` | UI affordances aligned with server-enforced permissions |
| `src/components/Campaign/` | Viewer/editor behavior aligned with the new permission model |

### Effort Estimate

~4-8 hours.

---

## Track P33-D — Access Management UI for Assigning, Editing, and Surfacing Roles

### Problem

The current access-management UI assumes grants are boolean. Users cannot see
or assign differentiated access levels even if the backend supports them.

### Fix

Update the access-management surfaces so admins can assign, edit, and understand
role levels without falling back to ad hoc documentation.

### Implementation Details

- Add role selectors to grant creation/edit flows in the access-management UI.
- Display clear role badges in access rows and related summary surfaces.
- Keep owner-only actions visually distinct from editor-level actions.
- Make the UI reflect server-side decisions, but do not rely on UI gating as
  the only enforcement layer.

### Acceptance criteria

- Admins can assign an explicit role when creating or editing a grant. (✅)
- Existing grants display their effective role clearly. (✅)
- Role-specific affordances and warnings are visible in the access-management
  UI. (✅)
- The UI stays aligned with the server-enforced permission matrix. (✅)

### Validation

- Add RTL/Vitest coverage for role selection and role badge rendering.
- Manual QA: create grants for each role and confirm the UI reflects the stored
  value.
- Manual QA: verify owner-only controls are not presented as editor-capable
  actions.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/AccessTab.tsx` | Role assignment/editing UI |
| `src/hooks/useAdminAccessState.ts` | Role-aware access mutation payloads |
| `src/hooks/useAccessRows.tsx` | Role badges and row labeling |
| `src/services/adminQuery.ts` | Query invalidation and updated access types |

### Effort Estimate

~3-5 hours.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Access audit log export | Still valuable, but it is adjacent to governance rather than a prerequisite for first-pass RBAC. |
| Access-summary capacity semantics | Existing summary UI already ships; capacity modeling is separate from RBAC and should not delay permission work. |
| Builder-specific sub-roles | If `editor` eventually needs finer-grained builder rights, treat that as a follow-on after the first permission contract proves stable. |

## Implementation Notes

- Default existing grants conservatively during migration unless a stronger
  ownership signal is already encoded elsewhere.
- Keep this phase centered on permission semantics and enforcement, not on
  broader auth-provider redesign.
- Cross-origin JWT refresh and standalone SPA auth remain separate backlog work.