# Phase 29 — Bug Fixes & UI Increments

**Status:** Complete
**Created:** 2026-05-18
**Last updated:** 2026-05-19

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P29-A | Fix campaign media delete wiping all items | Complete ✅ | Small |
| P29-B | Add description field to Create Template modal | Complete ✅ | XS |
| P29-C | CompactGridGallery: switch CSS Grid → Flexbox | Complete ✅ | Small |
| P29-D | Fix campaign ID leaking into media item ID on add | Complete ✅ | Small |
| P29-E | Admin Panel mobile responsiveness (below 768px) | Complete ✅ | Large |
| P29-F | Settings Panel: intuitive tab re-grouping | Planned | Medium |
| P29-G | LayoutBuilder: UX audit, improvements & tooling | Planned | Large |
| P29-H | Shared Grid Layout Engine | Pre-Evaluation | Medium |

---

## Rationale

1. A critical data-loss bug was reported: clicking the delete button on any single
   media item in the campaign editor's Media tab removed every item from the
   campaign instead of only the targeted one.
2. The fix touches both the PHP REST layer and the React hook in a single, tightly
   coupled change set — appropriate to land together as one phase.
3. Success: individual media items can be deleted without touching any other item;
   legacy campaigns whose items lack IDs are automatically repaired on next access.
4. The Create Template modal was missing a description input; the field is already
   persisted by the API — the omission was a UI gap, not a backend gap.
5. `CompactGridGallery` used `display: grid` with `auto-fit` columns, which
   distributes leftover space globally; switching to `display: flex; flex-wrap: wrap`
   gives `justifyContent` per-row control, so center/space-between settings work
   correctly on partially filled last rows.
6. P29-A was shipped but the media delete bug persisted in production because items were
   not missing an `id` — they had one, just the wrong one. `create_media` copies named
   URL route parameters into the payload for convenience, but `id` is both the campaign
   route capture and a media item field; every item was being stored with the campaign
   post ID as its media ID, making all items identical and any delete a full wipe.
7. The Admin Panel is fully functional at desktop and tablet breakpoints but breaks down
   significantly below 768px (Mantine `sm` breakpoint). Eight tab panels, most of which
   contain wide tables with 5-7 columns, are not adapted for mobile viewing. The tab
   navigation, filter bars, and form controls all assume horizontal space that phones
   do not provide.
8. The Settings Panel has 280+ individual controls distributed across 6 tabs with an
   imbalanced and inconsistent grouping — the "Gallery & Media" tab alone contains ~90
   settings covering 5 unrelated concerns, while related settings (backgrounds,
   navigation, tile appearance) are split across multiple tabs. This makes features hard
   to find and increases cognitive load.
9. The LayoutBuilder (`LayoutBuilderModal` and all dockview panels) is a fully-featured
   visual editor but has accumulated several UX gaps that increase cognitive load and
   reduce efficiency: no canvas-level slot creation, no multi-select in the Layers panel,
   a misleading Ctrl+V duplicate shortcut, one long ungrouped Properties scroll, no
   alignment/distribute tools, no media search, and no visual feedback for locked layers
   or toast notifications. A systematic audit produced 32 specific findings across
   critical issues, usability improvements, nice-to-haves, and suggested removals.
10. Review of the current builder implementation showed that the main risk is not any
  one missing control, but fragmented editor state: slot selection lives in the
  builder hook while overlay/background/mask selection lives in modal-local state.
  P29-G therefore starts with selection and workflow foundation work before layering on
  alignment, grouping, and import/export.
11. Several audit findings remain valuable but are no longer part of P29-G because they
  extend the builder workspace rather than the editing model itself. Floating toolbar,
  grid/ruler/measurement tooling, responsive preview, history-surface collapse, and
  dedicated route/workspace migration are split into Phase 30.

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Fix route regex or reject UUID-format IDs | Fix the regex — UUIDs are already in production data; the regex was simply too narrow. |
| B | Where to backfill missing IDs | Inside `list_media` on read, so legacy items are repaired automatically the first time the Media tab is opened — no separate migration script needed. |
| C | Grid layout engine for CompactGridGallery | Switch to `flex-wrap`; `auto-fit` grid distributes columns globally so `justifyContent` has no effect on the last row, while flex wrap distributes per row. |
| D | Remove `'id'` from the param-copy loop in `create_media` | The route `{id}` capture is the campaign post ID — removing it from the fallback loop means a missing body `id` field correctly falls through to `wp_generate_uuid4()` in `build_media_item_from_payload`. |
| E | Where full design-tool grouping belongs | Keep it in P29-G. The app is not yet in production, so this is the right time to absorb the larger template/editor-model shift instead of deferring it into a later polish phase. |
| F | Where builder workspace/tooling follow-ons belong | Move floating toolbar, grid/rulers/measurement tooling, responsive preview, history collapse, and route/workspace migration into Phase 30 so P29-G stays focused on the core editing model. |

---

## Track P29-A — Campaign Media Delete Wipes All Items

### Problem

Two bugs compounded to produce a complete data-loss event on every media delete
attempt in a campaign that carried legacy media items (stored without an `id`
field):

**Bug 1 — Route regex excluded hyphens.**
`wp_generate_uuid4()` produces IDs like `550e8400-e29b-41d4-a716-446655440000`.
The `DELETE /campaigns/{id}/media/{mediaId}` route pattern used
`[a-zA-Z0-9_]+` — no hyphen — so no UUID-based media item could ever match the
route. The frontend built the URL as:

```
DELETE /campaigns/123/media/undefined
```

because JavaScript coerces `undefined` (the value of `media.id` for legacy items
that arrived without an `id` field) to the literal string `"undefined"`.
`"undefined"` contains only alphabetic characters, so it **did** match the route.

**Bug 2 — `delete_media` called `update_post_meta` unconditionally.**
The PHP handler filtered the `$media_items` array and then always called
`update_post_meta`, even when no item was removed by the filter. WordPress's
`sanitize_meta` pipeline runs the `sanitize_media_items` callback on every
`update_post_meta` call for the `media_items` key. That callback **drops any
item whose `id` field is empty or absent**. Legacy items with no `id` were
silently discarded — all of them at once.

The frontend then ran its own filter:
```typescript
prev.filter((m) => m.id !== mediaItem.id)
// m.id === undefined, mediaItem.id === undefined → false for every item
```
All items were removed from React state, matching the backend erasure.

### Fix

Four changes across two files:

**1. Route regex — allow hyphens (`class-wpsg-rest.php`)**

Changed `[a-zA-Z0-9_]+` → `[a-zA-Z0-9_-]+` in both the route registration and
the custom-ID validation regex inside `build_media_item_from_payload`, so UUID
IDs produced by `wp_generate_uuid4()` can be routed and validated correctly.

**2. `delete_media` — validate and guard (`class-wpsg-rest.php`)**

- Return `400` immediately if `$media_id` is empty.
- Count items before and after the filter; return `404` if the count is unchanged
  (item not found).
- Only call `update_post_meta` when the item was actually found and removed,
  preventing the `sanitize_media_items` callback from running on an unmodified
  list.

**3. `list_media` — legacy ID backfill (`class-wpsg-rest.php`)**

After type normalization, iterate the items and assign a fresh UUID to any item
whose `id` field is missing or empty. Persist the backfilled list via
`update_post_meta` (and audit-log the count). Legacy campaigns are self-healing
on the first Media tab access.

**4. Frontend guard (`useUnifiedCampaignModal.ts`)**

- Reject delete attempts with a user-visible error if `mediaItem.id` is falsy
  (belt-and-suspenders; should not be reachable after the backend backfill).
- Use `encodeURIComponent(mediaItem.id)` when building the DELETE URL so any
  future ID format with reserved characters is safe.

### Acceptance criteria

- Clicking "delete" on one media item removes exactly that item; the remaining
  items are intact in both the UI and the database. ✅
- Clicking "delete" on a campaign that still has legacy items (no `id` field)
  shows a clear error instead of silently erasing the collection. ✅
- Opening the Media tab on a legacy campaign backfills UUIDs; a subsequent delete
  works correctly without reopening the modal. ✅
- PHPUnit and Vitest test suites pass with updated route patterns and new UUID /
  hyphenated IDs in the valid-ID test cases. ✅

### Validation

- PHP: `WPSG_REST_Routes_Test` — updated regex pattern and added UUIDs +
  hyphenated IDs (`item-1`, `valid-id-with-hyphens`,
  `550e8400-e29b-41d4-a716-446655440000`) to the valid-ID lists.
- Manual QA: open a campaign with 8 images, delete one → confirm 7 remain;
  confirm database `media_items` postmeta has 7 entries.
- Manual QA: open a legacy campaign (items without IDs) → confirm IDs are
  backfilled on load; then delete one → confirm it works.

---

## Track P29-B — Description Field on Create Template Modal

### Problem

The "New Template" modal in `TemplatesTab` only collected a name. The `createCampaignTemplate`
API already accepted a `description` field and persisted it, but the UI never exposed it.
Templates created through the UI always had an empty description, making the template list
less discoverable.

### Fix

- Added `createDescription` state (`useState<string>('')`).
- Added a `Textarea` input ("Description (optional)") to the modal form, rendered below the
  name field, with `minRows={2}` and `maxRows={4}`.
- Included `description: createDescription.trim()` in the `createCampaignTemplate` payload.
- Reset `createDescription` on both successful creation and modal close.
- Updated `useCallback` dependencies to include `createDescription`.

### Acceptance criteria

- The Create Template modal renders a "Description (optional)" textarea. ✅
- Submitting with a description populates `template.description` in the API response. ✅
- Submitting with an empty description sends `description: ''` (not `undefined`). ✅
- Closing the modal without creating clears the description field for the next open. ✅

### Validation

- `TemplatesTab.test.tsx` updated: `createCampaignTemplate` assertion now expects
  `{ name: 'My New Layout', description: '' }`.

---

## Track P29-C — CompactGridGallery: CSS Grid → Flexbox

### Problem

`CompactGridGallery` used `display: grid` with
`gridTemplateColumns: repeat(auto-fit, minmax(...))`. With `auto-fit`, the browser
determines column count globally for the entire grid; `justifyContent` on the grid
container has no effect on partially filled last rows — items collapse to the left
regardless of the alignment setting. Users setting `justifyContent: center` or
`justifyContent: space-between` in gallery settings saw no effect on the last row.

### Fix

Replaced the grid container with a flex container:

```tsx
display: 'flex',
flexWrap: 'wrap',
justifyContent: common.adapterJustifyContent || 'center',
```

Each `GridCard` is now wrapped in a `Box` that controls its sizing:

```tsx
<Box style={{
  flexBasis: `min(${cardWidthCss}, calc(50% - ${toCss(gap / 2, gapUnit)}))`,
  maxWidth: cardWidthCss,
  minWidth: 0,
}}>
  <GridCard ... />
</Box>
```

`flexBasis` replicates the `minmax(min(...), cardWidth)` sizing from the grid approach.
`maxWidth` caps items at the configured card width. Per-row distribution is now handled
by the browser's flex algorithm, so `justifyContent` applies to every row independently.

### Acceptance criteria

- Gallery renders in a wrapping flex layout with correct card sizing. ✅
- `justifyContent` setting affects all rows including the last. ✅
- Card aspect ratio, border radius, and lightbox behaviour are unchanged. ✅

### Validation

- `adapters.test.tsx`: query selector updated from `div[style*="grid-template-columns"]`
  to `div[style*="flex-wrap"]` to match the new DOM shape.

---

## Track P29-D — Campaign ID Leaking Into Media Item ID

### Problem

P29-A fixed the case where items had *no* ID. The delete-wipes-all bug persisted
because the Bare Home campaign's items were not missing IDs — they all had `id: "89"`,
the campaign's own post ID.

Root cause: `create_media` uses a convenience loop that copies named URL-route parameters
into the JSON payload for any field that was not supplied by the client:

```php
foreach (['id', 'type', 'source', ...] as $key) {
    if (!array_key_exists($key, $payload)) {
        $payload[$key] = $request->get_param($key); // pulls from URL route
    }
}
```

For the route `POST /campaigns/(?P<id>\d+)/media`, `$request->get_param('id')` returns
the campaign's post ID. Since the frontend never sends an `id` key in the JSON body,
`$payload['id']` was silently set to the campaign post ID (e.g. `"89"`).
`build_media_item_from_payload` then treated that as a valid custom media ID — it is
alphanumeric and passes the regex — so every item added from the library was stored with
the same ID. Any delete filtered by that ID and removed all items at once.

### Fix

Two changes to `class-wpsg-rest.php`:

**1. `create_media` — exclude `'id'` from the param-copy loop**

```php
// 'id' excluded: the route's {id} is the campaign post ID, not a media item ID.
foreach (['type', 'source', 'url', 'attachmentId', 'caption', 'order', 'thumbnail', 'provider', 'title'] as $key) {
```

The client can still supply a custom media ID via the JSON body; if absent,
`build_media_item_from_payload` generates a UUID as intended.

**2. `list_media` — extend backfill to repair duplicate IDs**

The existing backfill already assigned UUIDs to items with *empty* IDs. Extended to
also reassign any ID that has already been seen in the same campaign's media list:

```php
$seen_ids = [];
foreach ($media_items as &$item) {
    $current_id = $item['id'] ?? '';
    if ($current_id === '' || isset($seen_ids[$current_id])) {
        $item['id'] = wp_generate_uuid4();
        $ids_backfilled++;
    } else {
        $seen_ids[$current_id] = true;
    }
}
```

On the next `GET /campaigns/89/media` call, 9 of the 10 duplicate items were assigned
fresh UUIDs and persisted. Individual deletes then worked correctly.

### Acceptance criteria

- Each media item added from the library gets a unique UUID, not the campaign post ID. ✅
- Existing campaigns with corrupted (duplicate) IDs are self-healed on next Media tab open. ✅
- Deleting one item from the Bare Home campaign leaves the rest intact. ✅

---

## Track P29-E — Admin Panel Mobile Responsiveness

### Problem

The Admin Panel — rendered as an inline `<Card>` inside `<App.tsx>` when `isAdminPanelOpen` — is
fully functional at desktop (≥992px) and tablet (≥768px) breakpoints, but has no mobile-adapted
layouts below the Mantine `sm` breakpoint (768px). The panel contains eight tabs, most of which
render wide tables with fixed `minWidth` constraints, inline filter controls, and multi-column
form layouts that assume horizontal space.

**Mantine breakpoints (from `_base.json`):**

| Key | Value | Pixel equivalent |
|-----|-------|------------------|
| `xs` | `36em` | 576px |
| `sm` | `48em` | 768px ← target breakpoint |
| `md` | `62em` | 992px |
| `lg` | `75em` | 1200px |
| `xl` | `88em` | 1408px |

### Specific Issues by Component

#### 1. Tab Navigation (`AdminPanel.tsx:243`)

Eight tabs rendered in a `<Tabs.List>` with `overflowX: 'auto'` and `flexWrap: 'nowrap'`:
Campaigns, Media, Layouts, Templates, Access, Audit, Global Audit, Analytics. On a 375px
iPhone this requires awkward horizontal scrolling to reach the rightmost tabs.

#### 2. Header Action Bar (`AdminPanel.tsx:220-239`)

Title + three buttons ("New Campaign", "Import", keyboard shortcut icon) in a single
`<Group justify="space-between">`. On narrow screens the buttons wrap below the title,
consuming two rows of vertical space.

#### 3. Campaigns Table (`CampaignsTab.tsx:103`)

`<Table.ScrollContainer minWidth={720}>` with 7 columns (checkbox, Title, Status, Visibility,
Company, Grants, Actions). Forces horizontal scroll on every screen under 720px.

#### 4. Campaigns Filter Bar (`AdminPanel.tsx:255-300`)

Category chips (potentially many), tag `<Select>`, sort `<Select>`, and archived `<Switch>`
in a single row. On mobile this wraps into a tall vertical stack that pushes the table
far below the fold.

#### 5. Media Tab (`MediaTab.tsx`)

- CampaignSelector with `minWidth: 200` alongside Rescan button
- Grid view: `sizeConfig` spans already have responsive breakpoints (`{ base: 12, sm: 6, md: 4 }`)
  so the grid itself is partially responsive
- List view: `<Table.ScrollContainer minWidth={720}>` — same problem as Campaigns
- Toolbar: SegmentedControl + card size toggle + "Exclusive only" switch + Rescan + Add Media
  buttons all in one row

#### 6. Layouts Tab (`LayoutTemplateList.tsx`)

- Grid cards: `gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'` — cards squeeze to
  220px minimum, which is ~59% of a 375px screen width
- List view: `<Table.ScrollContainer minWidth={600}>` with 6 columns
- Toolbar: search input (`minWidth: 200`), SegmentedControl, Import, New Layout, From Preset
  buttons

#### 7. Templates Tab (`TemplatesTab.tsx`)

- `TemplateRow` uses `wrap="nowrap"` on the Group — will truncate or overflow on narrow screens
- No table, but the row layout doesn't adapt

#### 8. Access Tab (`AccessTab.tsx`)

Most complex tab with multiple compounding issues:

- SegmentedControl (Campaign/Company/All) + `<Select>` in same row — wraps awkwardly
- Context info badges (company, status, user count) stack poorly
- Current Access table: `<Table>` with `minWidth: 640`, wrapped in `<ScrollArea style={{ maxHeight: 300 }}>`
- Grant form: `<Group>` with combobox (`minWidth: 250`), two Selects (`minWidth: 180`, `minWidth: 150`),
  datetime `<TextInput>` (`minWidth: 200`), and two buttons — all in one row
- PendingRequestsPanel: tables without minWidth but with 3-column layout (Email, Requested, Actions)

#### 9. Audit Tab (`AuditTab.tsx`)

- Campaign selector (200px) + 3 text inputs (150-160px each) + Export button in one `<Group>`
- Table: `<Table>` with `minWidth: 640` in `<ScrollArea h={360}>`
- 4 columns: When, Action, User, Details

#### 10. Global Audit Tab (`GlobalAuditTab.tsx`)

- 4 text inputs (130-160px each) + Export button
- Table: `<Table>` with `minWidth: 720` in `<ScrollArea h={400}>`
- 5 columns: When, Action, Campaign, User, Details

#### 11. Analytics Dashboard (`AnalyticsDashboard.tsx`)

- `SimpleGrid cols={{ base: 2, sm: 4 }}` — already responsive ✅
- Chart container: `ResponsiveContainer` with fixed `height={280}` — could be reduced on mobile
- Media Performance and Top Campaigns tables: no minWidth but no mobile adaptation
- Controls: `<SimpleGrid cols={{ base: 1, sm: 2 }}>` — already responsive ✅

#### 12. BulkActionsBar (`BulkActionsBar.tsx:38`)

`<Group justify="space-between" wrap="nowrap">` — will overflow horizontally on narrow screens.

#### 13. PendingRequestsPanel (`PendingRequestsPanel.tsx`)

- Two `<Table>` elements with 3 columns each (Email, Requested/Resolved, Actions)
- No `minWidth` but no mobile card layout
- Approve/Deny buttons with `wrap="nowrap"` in actions cell

### Fix Strategy

Use Mantine's responsive utilities and the existing `useBreakpoint` hook
(`src/hooks/useBreakpoint.ts`) to conditionally render mobile-optimized layouts below the `sm`
breakpoint (768px). The hook returns `{ breakpoint: 'mobile' | 'tablet' | 'desktop', width }`
and is already tested. Use `source: 'viewport'` throughout the Admin Panel — it occupies the
full viewport on mobile, so viewport width is the correct signal (unlike gallery widgets where
container width matters).

#### P0 — Tab Navigation

Replace `<Tabs.List>` with a `<Select>` dropdown below `sm`. This keeps `<Tabs>` as the single
source of truth for the active panel — the Select just calls `setActiveTab(value)` on change.
An Accordion approach was considered but rejected: Mantine's Accordion expects panel content
*inside* its items, whereas the tab panels live in `<Tabs.Panel>` elements outside any
accordion, so the two systems would have to be kept in sync, which is fragile.

```tsx
{isMobile ? (
  <Select
    value={activeTab ?? 'campaigns'}
    onChange={(v) => setActiveTab(v)}
    data={[
      { value: 'campaigns', label: 'Campaigns' },
      { value: 'media', label: 'Media' },
      // ...
    ]}
    mb="sm"
  />
) : (
  <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
    {/* existing tabs */}
  </Tabs.List>
)}
```

#### P0 — Campaigns Tab: Table → Card List

Below `sm`, render a `<CampaignsMobileList>` component instead of `<CampaignsTab>`. Each card
shows title, description, status/visibility/schedule badges, company, grants, and action buttons
in a compact stacked layout. `<CampaignsTab>` (desktop table) is unchanged.

```
┌────────────────────────────┐
│ Campaign Title             │
│ Short description…         │
│ 🟢 Active  🔒 Private  🏢 Acme │
│ 3 grants                   │
│ ───────────────────────── │
│ [Edit] [Clone] [Export]    │
│ [Archive] [Delete]         │
└────────────────────────────┘
```

#### P1 — Access Grant Form: Remove minWidth Constraints on Mobile

The grant form `<Group wrap="wrap">` already wraps — but `minWidth` values (250/180/150/200px)
on each field prevent full-width stacking. Below `sm`, set `minWidth: undefined` and
`width: '100%'` on each input so they fill the column. No structural change needed.

#### P1 — Access Table: Table.ScrollContainer

Wrap the Current Access table (and its loading skeleton) in `<Table.ScrollContainer>` so the
640px-wide table scrolls horizontally on narrow viewports instead of overflowing.

#### P1 — Layouts Grid Column Reduction

Below `sm`, use `gridTemplateColumns: '1fr'` (single column) instead of
`repeat(auto-fill, minmax(220px, 1fr))`.

#### P1 — Templates Row + BulkActionsBar Wrapping

- Change `TemplateRow` Group from `wrap="nowrap"` to `wrap="wrap"`.
- Change `BulkActionsBar` outer `<Group wrap="nowrap">` to `wrap="wrap"`.

#### P2 — Audit / Global Audit: Table.ScrollContainer

Both audit tabs already use a vertical `<ScrollArea>`; adding `<Table.ScrollContainer>` around
the inner tables enables horizontal scroll on mobile. Card-based mobile views were considered
but rejected: audit logs are a power-user feature rarely read on mobile, and the horizontal
scroll pattern is acceptable for tabular data in this context.

#### P2 — Header Action Buttons

The header Group already has `wrap="wrap"`, so buttons fall below the title on narrow screens
rather than overflowing. A full collapse-into-menu approach is a polish item deferred until
after P0/P1 items are validated.

#### P2 — Filter Bar Collapsible

The Campaigns filter row also has `wrap="wrap"` and doesn't overflow; it just consumes vertical
space. A Mantine `<Collapse>` toggle (one button, ~5 lines) is sufficient when this is
prioritised. Deferred post-P0/P1 validation.

### Acceptance criteria

- Tab navigation is usable on a 375px viewport without horizontal scrolling. ✅
- Campaigns tab renders as cards on mobile; each card shows title, status, visibility,
  company, grants, and all action buttons (Edit, Clone, Export, Archive/Restore, Delete). ✅
- Access tab grant form controls stack to full width on mobile; no horizontal overflow. ✅
- Audit and Global Audit tables scroll horizontally within their container on mobile;
  no content clips or overflows the panel edge. ✅ *(card view was considered and rejected
  in favour of horizontal scroll — audit logs are a power-user feature rarely read on mobile)*
- Analytics stat cards remain in 2-column grid on mobile (already implemented). ✅
- Header action buttons ("New Campaign", "Import", shortcuts) collapse into a ⋮ Menu on
  mobile; title and back arrow remain always visible. ✅
- Campaign filter bar collapses behind a "Filters / Filters (n)" toggle button on mobile;
  badge shows active filter count at a glance. ✅
- All existing desktop and tablet layouts (≥ 768px) are unchanged. ✅
- `useBreakpoint` hook with `source: 'viewport'` is used for all responsive decisions. ✅
- No regressions in existing Vitest test suites. ✅
- Deployed bundle verified on live site (wordpress.lan): plugin REST API healthy, all
  mobile code strings present in minified bundle. ✅

### Implementation Plan (completed)

**Step 1 ✅ — Trivial wrapping fixes.** `BulkActionsBar` outer `wrap="nowrap"` → `wrap="wrap"`;
`TemplatesTab` `TemplateRow` same change.

**Step 2 ✅ — Audit table horizontal scroll.** Both audit tab tables wrapped in
`<Table.ScrollContainer>` inside their existing vertical `<ScrollArea>`.

**Step 3 ✅ — Access table horizontal scroll.** Current Access table and loading skeleton
wrapped in `<Table.ScrollContainer>`.

**Step 4 ✅ — Tab navigation Select.** `useBreakpoint` (`source: 'viewport'`) added to
`AdminPanel.tsx`. Below `sm`, a `<Select>` drives `setActiveTab`; at `sm+`, existing
`<Tabs.List>` renders unchanged.

**Step 5 ✅ — Campaigns mobile card list.** `CampaignsMobileList.tsx` created. `AdminPanel`
renders it instead of `<CampaignsTab>` when `isMobile`. Desktop table unchanged.

**Step 6 ✅ — Access grant form mobile stacking.** `isMobile` prop added to `AccessTab`;
on mobile, `minWidth` constraints removed and `width: '100%'` applied to each grant-form input.

**Step 7 ✅ — Layouts grid mobile.** `useBreakpoint` added to `LayoutTemplateList`; grid
switches to `gridTemplateColumns: '1fr'` single-column below `sm`.

**Step 8 — Analytics chart height.** Deferred — low user impact, no complaints.

**Step 9 ✅ — Header Menu + filter Collapse toggle.** Header actions collapse into a Mantine
`<Menu>` on mobile. Filter controls collapse behind a `<Collapse expanded>` toggle with an
active-filter count badge.

### Validation

- **Bundle check (CLI, 2026-05-19):** key string literals confirmed in deployed
  `AdminPanel-Dd_ZANgc.js`: `"Hide filters"`, `"Actions menu"`, `"Select admin panel tab"`,
  `"CampaignsMobileList"`, `"AdminPanel:CampaignsMobileList"`. Build and deploy timestamps
  both `May 19 06:21`.
- **REST API check (CLI, 2026-05-19):** `GET /wp-json/wp-super-gallery/v1/campaigns`
  → HTTP 200, well-formed JSON. No PHP errors in response.
- **User QA (2026-05-19):** P0/P1 items (tab Select, campaign cards, Access form, audit
  scroll, Layouts grid, wrap fixes) confirmed working on live site. P2 items (header Menu,
  filter Collapse) deployed and confirmed immediately after.
- **tsc + ESLint:** all three commit hooks passed clean.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/AdminPanel.tsx` | `useBreakpoint`; Select tab nav on mobile; `isMobile` prop to AccessTab; conditional `CampaignsMobileList` |
| `src/components/Admin/CampaignsMobileList.tsx` | **New file** — campaign card list for mobile |
| `src/components/Admin/AccessTab.tsx` | `isMobile` prop; remove `minWidth` on grant form inputs; `Table.ScrollContainer` on access table |
| `src/components/Admin/AuditTab.tsx` | `Table.ScrollContainer` around tables (horizontal scroll) |
| `src/components/Admin/GlobalAuditTab.tsx` | `Table.ScrollContainer` around tables (horizontal scroll) |
| `src/components/Admin/LayoutTemplateList.tsx` | `useBreakpoint`; `gridTemplateColumns: '1fr'` on mobile |
| `src/components/Admin/TemplatesTab.tsx` | `TemplateRow` `wrap="nowrap"` → `wrap="wrap"` |
| `src/components/Admin/BulkActionsBar.tsx` | Outer `wrap="nowrap"` → `wrap="wrap"` |
| `src/components/Admin/AnalyticsDashboard.tsx` | Chart height reduction on mobile |

### Effort Estimate

~10-13 hours. Audit/Global Audit card conversion is dropped (horizontal scroll is sufficient
for power-user features rarely read on mobile); PendingRequestsPanel card conversion also
dropped (3-column table, scroll is fine). The Accordion tab-nav approach is replaced with a
simpler Select dropdown. The remaining work — campaign cards, Access form stacking, layout grid
reduction, wrap fixes — follows a repeating pattern.

---

## Track P29-F — Settings Panel: Intuitive Tab Re-grouping

### Problem

The Settings Panel (`SettingsPanel.tsx`) exposes 280+ individual controls across 6 tabs with an
imbalanced, inconsistent grouping that makes features hard to find. The "Gallery & Media" tab
alone contains approximately 90 settings covering 5 unrelated concerns.

**Current tab structure:**

| Current Tab | Sections (Accordion Items) | Estimated Setting Count |
|-------------|---------------------------|------------------------|
| Page & Theme | Theme & Layout, Page Container, Page Header, Page Background, Auth Bar, Security & Login | ~30 |
| Campaign Cards | Card Appearance, Card Grid & Pagination, Card Internals | ~55 |
| Gallery & Media | Viewport & Layout, Tile Appearance, Thumbnail Strip, Transitions, Navigation, Gallery Adapters, Viewport Backgrounds, Carousel Settings, Section Sizing & Spacing, Adapter Sizing | ~90 |
| Campaign Viewer | Open Mode & Sizing, Modal Appearance, Content Visibility, Gallery Labels, Modal Background, Cover Image & Responsive | ~40 |
| System & Admin *(hidden behind `advancedSettingsEnabled`)* | Settings Drawer, Upload/Media, Tile/Adapter, Lightbox, Navigation, System, Developer & Debugging, Data Maintenance | ~55 |
| Typography | Font Library Manager, 16 element overrides | ~16 |

**Specific problems identified:**

1. **Backgrounds scattered across 4 locations.** Page-level background in `Page & Theme`,
   gallery viewport backgrounds in `Gallery & Media`, modal background in `Campaign Viewer`.
   These are conceptually the same kind of decision (choosing a background type/color/gradient)
   but require jumping between 3 tabs.

2. **"Gallery & Media" is a massive catch-all.** This single tab mixes: adapter selection
   (which gallery layout per breakpoint), tile/media appearance (borders, shadows, gaps,
   hover effects), gallery structure (section sizing, adapter sizing, carousel config),
   navigation (arrows, dots, scroll behavior), and transitions & animations. ~90 settings
   in one tab.

3. **"Card Grid & Pagination" vs "Gallery Adapters" confusion.** Card grid layout
   (campaign listing page) and gallery adapters (inside campaign viewer) are both grid-layout
   concepts but live in completely different tabs. A user adjusting grid aesthetics has to
   think: "Is this a card or a gallery tile?"

4. **Navigation split between two tabs.** Gallery navigation (arrows, dots) lives in
   `Gallery & Media -> Navigation`. Advanced navigation (arrow insets, hit targets, viewport
   ratios, search input widths) lives in `System & Admin -> Navigation`. Same conceptual
   domain, split by expertise level.

5. **Tile Appearance (Gallery & Media) vs Tile/Adapter (System & Admin).** Both control
   tile-level visual behavior but one is "normal" and the other is "advanced" — same
   conceptual domain, split across tabs.

6. **Security & Login buried in Page & Theme.** Session idle timeout, advanced settings
   toggle, and tooltips toggle are operational settings, not page theming.

7. **Modal sizing/appearance split.** Modal dimensions in `Campaign Viewer -> Open Mode &
   Sizing` but close button, cover ratios, and mobile breakpoint in `Cover Image &
   Responsive`.

### Proposed New Structure

Reorganize from 6 tabs to 7 visible tabs (+ 1 hidden) by splitting the bloated "Gallery &
Media" into three focused tabs.

| New Tab | Sections (Accordion Items) | Estimated Setting Count | Source Components |
|---------|---------------------------|------------------------|-------------------|
| **1. Appearance** | Theme & Layout, Page Container, Page Background, Page Header, Auth Bar, Security & Login | ~30 | `GeneralSettingsSection` (unchanged) |
| **2. Cards** | Card Appearance, Card Grid & Pagination, Card Internals | ~55 | `CampaignCardSettingsSection` (unchanged) |
| **3. Gallery Layout** | Gallery Adapters, Viewport Backgrounds, Section Sizing & Spacing, Adapter Sizing, Carousel Settings | ~40 | `GalleryLayoutSettingsSection` (unchanged — already contains all five) |
| **4. Gallery Style** | Viewport & Layout (lightbox toggle, viewport dimensions, border radius, shadows), Tile Appearance, Transitions | ~35 | `GalleryStyleAccordion` extracted from `MediaDisplaySettingsSection` (items: `viewport`, `tile-appearance`, `transitions`) |
| **5. Gallery Navigation** | Navigation (arrows, dots, scroll), Thumbnail Strip | ~25 | `GalleryNavigationAccordion` extracted from `MediaDisplaySettingsSection` (items: `navigation`, `thumbnail-strip`) |
| **6. Campaign Viewer** | Open Mode & Sizing, Modal Appearance, Content Visibility, Gallery Labels, Modal Background, Cover Image & Responsive | ~40 | `CampaignViewerSettingsSection` (unchanged) |
| **7. Typography** | Font Library Manager, 16 element overrides | ~16 | `TypographySettingsSection` (unchanged) |
| **8. System** *(hidden behind `advancedSettingsEnabled`)* | Magic Link Page Selector, Settings Drawer, Upload/Media, Tile/Adapter, Lightbox, Navigation, System, Developer & Debugging, Data Maintenance | ~55 | `AdvancedSettingsSection` (unchanged) |

**Key changes:**

- Split "Gallery & Media" (~90 settings) into 3 focused tabs: Gallery Layout (~40),
  Gallery Style (~35), Gallery Navigation (~25).
- Security & Login stays in the Appearance tab. Moving it to System would gate the
  `advancedSettingsEnabled` toggle behind the very tab it controls — a chicken-and-egg
  that makes the System tab permanently unreachable when disabled.
- Viewport Backgrounds stay in Gallery Layout (rendered by `GalleryLayoutSettingsSection`
  unchanged). They are a viewport-level structural concern, not a tile-appearance concern,
  and separating them would require modifying the parent/child accordion coupling inside
  that component.
- All existing accordion section components are unchanged — `MediaDisplaySettingsSection`
  is split by extracting two named sub-components from it; nothing else is restructured.
- Each tab now has a distinct icon (no duplicates).
- Total goes from 6 to 7 visible tabs (+ 1 hidden), but each tab is now 16-55 settings
  instead of 16-90, making everything findable in 1-2 clicks.

### Fix

Primary change is in `SettingsPanel.tsx`. `MediaDisplaySettingsSection.tsx` is split by
extracting two named sub-components. All other section components are untouched.

**Step 1 — Rename and restructure tabs.**

Replace the existing tab definitions with the new structure. Use a distinct icon for every
tab — no two tabs share the same icon:

```tsx
<Tabs.List>
  <Tabs.Tab value="appearance" leftSection={<IconSettings size={16} />}>
    Appearance
  </Tabs.Tab>
  <Tabs.Tab value="cards" leftSection={<IconLayoutGrid size={16} />}>
    Campaign Cards
  </Tabs.Tab>
  <Tabs.Tab value="gallery-layout" leftSection={<IconPhoto size={16} />}>
    Gallery Layout
  </Tabs.Tab>
  <Tabs.Tab value="gallery-style" leftSection={<IconPalette size={16} />}>
    Gallery Style
  </Tabs.Tab>
  <Tabs.Tab value="gallery-navigation" leftSection={<IconArrowsHorizontal size={16} />}>
    Gallery Navigation
  </Tabs.Tab>
  <Tabs.Tab value="viewer" leftSection={<IconEye size={16} />}>
    Campaign Viewer
  </Tabs.Tab>
  <Tabs.Tab value="typography" leftSection={<IconTypography size={16} />}>
    Typography
  </Tabs.Tab>
  {settings.advancedSettingsEnabled && (
    <Tabs.Tab value="system-admin" leftSection={<IconAdjustments size={16} />}>
      System & Admin
    </Tabs.Tab>
  )}
</Tabs.List>
```

**Step 2 — Re-parent accordion sections under new tabs.**

Component imports and props remain identical throughout.

- "Appearance" tab: Render `GeneralSettingsSection` unchanged (all 6 accordion items
  including Security & Login stay here).
- "Gallery Layout" tab: Render `GalleryLayoutSettingsSection` unchanged (already contains
  Gallery Adapters, Viewport Backgrounds, Carousel Settings, Section Sizing, Adapter Sizing).
- "Gallery Style" tab: Render `GalleryStyleAccordion` (extracted from
  `MediaDisplaySettingsSection` — accordion items: `viewport`, `tile-appearance`,
  `transitions`).
- "Gallery Navigation" tab: Render `GalleryNavigationAccordion` (extracted from
  `MediaDisplaySettingsSection` — accordion items: `navigation`, `thumbnail-strip`).

**Step 3 — Update default active tab.**

Change the default active tab from `'page-theme'` to `'appearance'` to match the new
tab value.

### Implementation Details

**`SettingsPanel.tsx` — Tab value mapping:**

| Old tab value | New tab value | Notes |
|--------------|---------------|-------|
| `page-theme` | `appearance` | Renamed |
| `cards` | `cards` | Unchanged |
| `gallery-media` | Split into `gallery-layout`, `gallery-style`, `gallery-navigation` | 1 becomes 3 |
| `viewer` | `viewer` | Unchanged |
| `system-admin` | `system-admin` | Unchanged |
| `typography` | `typography` | Unchanged |

**`MediaDisplaySettingsSection.tsx` — Splitting strategy:**

Currently this component renders all accordion items together. To split it across two tabs,
extract the accordion items into two separate render functions or sub-components:

```tsx
// Extracted from MediaDisplaySettingsSection.tsx:
export function GalleryStyleAccordion({ settings, updateSetting, tooltipLabel }) {
  // Renders accordion items: viewport, tile-appearance, transitions
  // Does NOT include GalleryPresentationSections (backgrounds stay in Gallery Layout)
}

export function GalleryNavigationAccordion({ settings, updateSetting, tooltipLabel }) {
  // Renders accordion items: navigation, thumbnail-strip
}
```

Then in `SettingsPanel.tsx`:

```tsx
<Tabs.Panel value="gallery-style" pt="md">
  <GalleryStyleAccordion
    settings={settings}
    updateSetting={updateSetting}
    tooltipLabel={tt}
  />
</Tabs.Panel>

<Tabs.Panel value="gallery-navigation" pt="md">
  <GalleryNavigationAccordion
    settings={settings}
    updateSetting={updateSetting}
    tooltipLabel={tt}
  />
</Tabs.Panel>
```

`GalleryPresentationSections` (backgrounds) is not moved — it continues to render as a
child of `GalleryLayoutSettingsSection`'s accordion, which renders unchanged in the
"Gallery Layout" tab. Extracting it would require modifying the parent/child accordion
coupling inside `GalleryLayoutSettingsSection` and is not worth the complexity here.

**`GeneralSettingsSection.tsx` — No changes needed.** Security & Login (`gen-security`)
remains here. Moving it to System tab would create a chicken-and-egg: a user with
`advancedSettingsEnabled = false` can never see the System tab, and therefore can never
reach the toggle to enable it.

**`AdvancedSettingsSection.tsx` — No changes needed.**

### Acceptance criteria

- All existing settings are accessible in the new tab structure with no settings lost.
- Each tab contains 16-55 settings (no tab exceeds 55).
- Background-related settings are co-located within their parent context (Appearance for
  page, Gallery Layout for gallery viewport, Campaign Viewer for modal).
- Navigation settings (arrows, dots, thumbnail strip, scroll behavior) are consolidated
  under Gallery Navigation.
- Security & Login accordion remains in the Appearance tab; the `advancedSettingsEnabled`
  toggle is always reachable regardless of System tab visibility.
- All existing accordion section components are preserved with their internal structure
  unchanged; `MediaDisplaySettingsSection` is the only file that gains new exports.
- `advancedSettingsEnabled` gate still controls visibility of the System & Admin tab.
- Each tab has a distinct icon — no two tabs share the same icon.
- No regressions in existing SettingsPanel tests (`SettingsPanel.test.tsx`).
- E2E test `mantine8-runtime-qa.spec.ts` passes (may need tab name updates).

### Validation

- Manual QA: open Settings Panel, verify all 7 visible tabs (+ System when enabled) are
  accessible and contain the expected accordion sections.
- Manual QA: toggle `advancedSettingsEnabled` on/off — verify System tab appears/disappears.
- Manual QA: verify no accordion item is rendered in two places.
- Manual QA: confirm Security & Login is accessible in the Appearance tab with
  `advancedSettingsEnabled = false` (System tab not visible).
- Vitest: `SettingsPanel.test.tsx` — update tab value references if any exist.
- E2E: `mantine8-runtime-qa.spec.ts` — update tab role names if they reference
  "Gallery & Media" or "Page & Theme".

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/SettingsPanel.tsx` | Rename/restructure tabs; re-parent accordion sections; update default active tab; update icon imports |
| `src/components/Settings/MediaDisplaySettingsSection.tsx` | Extract `GalleryStyleAccordion` and `GalleryNavigationAccordion` as named exports |
| `src/components/Admin/SettingsPanel.test.tsx` | Update tab value references |
| `e2e/mantine8-runtime-qa.spec.ts` | Update tab role names ("Gallery & Media" → "Gallery Layout", "Page & Theme" → "Appearance", etc.) |

### Effort Estimate

~3-5 hours. The work is primarily re-organizing imports, tab values, and accordion section
placement in `SettingsPanel.tsx`. The `MediaDisplaySettingsSection` split requires careful
extraction of accordion items but no logic changes. No other section components need
modification. Test updates are mechanical find-and-replace.

---

---

## Track P29-G — LayoutBuilder: UX Audit, Improvements & Tooling

### Problem

The LayoutBuilder (`LayoutBuilderModal` + all dockview panels under
`src/components/Admin/LayoutBuilder/`) is a fully-featured visual editor with dockview
panels for Layers, Media & Assets, Canvas, Properties, and History. It supports slots
with clip-path shapes, graphic layers (overlays), mask layers, advanced backgrounds
(color/gradient/image), media assignment, smart guides, undo/redo (50-entry history
stack with jump), keyboard shortcuts, zoom/pan canvas, and layer lock/visibility.

A comprehensive UX audit of the entire codebase identified **32 specific findings**
organized into four severity tiers. The builder is functional and feature-complete but
has accumulated UX gaps that increase cognitive load, reduce workflow efficiency, and
create confusion for new users.

#### Critical Issues (require immediate attention)

1. **No canvas-level slot creation.** The only way to add a slot is the `+` icon in the
   Layers panel toolbar. Users expect to be able to create slots directly on the canvas
   (double-click or a canvas toolbar button). Media drop-to-canvas creates a slot, but
   there is no "blank slot" creation path on the canvas itself.

2. **Dead space in Properties panel when nothing is selected.** Renders
   `"Select a layer to edit its properties."` — wasted screen real estate that could
   show canvas-level/global properties, quick-add palette, or recently used actions.

3. **No multi-select in Layers panel.** Canvas supports Shift+click multi-select, but the
   Layers panel (where power users work) only supports single selection. Cannot select
   multiple slots from the layer list for batch operations.

4. **Duplicate uses Ctrl+V (confusing, non-standard).** The shortcut for duplicate is
   `Ctrl+V` (paste), which conflicts with the universal Copy/Paste mental model and has
   no corresponding Ctrl+C copy action. `Ctrl+D` is the standard duplicate shortcut in
   Figma, VS Code, and most design tools.

5. **Locked slots have no visual indicator on canvas.** Hidden slots show at 10% opacity
   (ghost), which is correct. But locked slots have zero visual distinction on the
   canvas — only in the Layers panel icon. Users can't tell a locked slot from an
   unlocked one while working on the canvas.

#### Usability Improvements (high impact)

6. **Properties panel is one long ungrouped scroll.** `SlotPropertiesPanel` has ~15
   sections (Name, Position, Size, Shape, Image, Focal Point, Border, Stacking,
   Interaction, Filters × 8 sliders, Shadow, Blend, Overlay, 3D Tilt) in a single
   vertical scroll. Users scanning for "Border" or "Z-Index" must scroll past everything.

7. **No alignment/distribute tools.** Smart guides help with manual alignment, but there
   are no "Align Left/Center/Right", "Distribute Horizontally/Vertically" buttons for
   multi-selected slots. Standard in every design tool.

8. **No grouping feature.** Users cannot group multiple slots together to move/resize
   them as a unit. No Ctrl+G / Ctrl+Shift+G equivalent.

9. **No "Fit to Screen" zoom.** Can reset zoom (double-click or press 0) and see current
   %, but no auto-calculated "Fit to Screen" that computes the best zoom for the current
   viewport.

10. **No ruler or measurement indicators.** No horizontal/vertical rulers along canvas
    edges showing scale and position markers.

11. **Media picker has no search/filter.** For campaigns with 50+ images, finding a
    specific image in a scrollable list is painful.

12. **No thumbnail grid view in media picker.** Media items are shown as a list with
    40×40 thumbnails only. A grid view would be more visual for image selection.

13. **Auto-assign has no control.** Single button fills slots in order only. No reverse,
    shuffle, or skip options.

14. **No responsive preview.** Preview mode shows layout at canvas size only. No way to
    preview at different viewport widths (mobile/tablet).

#### Feedback & Polish (medium impact)

15. **"Unsaved" indicator is subtle.** Small italic dimmed text next to Save button.
    Standard pattern (VS Code, Figma) is a dot or asterisk next to the document name.

16. **No JSON import/export.** Users can save to DB but cannot export a template for
    sharing, backup, or cross-site transfer.

17. **No grid overlay / snap-to-grid.** Snap only works to other slots (smart guides).
    No option to show a background grid and snap to it.

18. **No contextual floating toolbar.** When a slot is selected, no inline quick-actions
    (duplicate, delete, add mask, change shape) appear near the selection.

30. **No toast notifications.** Actions like "Slot added", "Media assigned", "Layer
     deleted" have no visual feedback — only a11y announcements. Users may not know if
     their action succeeded.

31. **No error recovery message for failed saves.** If save fails, error is shown via
     `onNotify` but no "Draft restored" message on reopen.

32. **Canvas dimensions shown as plain text.** Could be a more informative overlay or
     tooltip showing dimensions + aspect ratio.

#### Suggested Removals / Simplifications

25. **Remove "Save & Close" button.** Having both "Save" and "Save & Close" creates
    decision overhead. Close already has a dirty guard. Reduces header clutter.

26. **Move aspect ratio selector out of header center.** Currently in the middle of the
    header bar — unusual location for a canvas-level property. Belongs in Properties
    panel or Canvas footer.

27. **Make slot index badges togglable (or hide by default).** Numbered badges always
    visible on every slot, distracting for complex layouts. Layer panel already shows
    order.

28. **Reduce History panel redundancy.** History is a full dock tab AND undo/redo buttons
    exist in header. Most users use Ctrl+Z. Consider collapsing into a header dropdown.

29. **Move canvas height mode controls out of footer.** Advanced setting that clutters
    the canvas footer bar. Belongs in Properties panel.

### Fix Strategy

Split into **5 sub-tracks** following the established P0/P1/P2 priority pattern from
P29-E, ordered by impact-to-effort ratio.

---

#### P29-G-A — Critical UX Fixes (P0)

**Scope:** Items 1-5 above. These are high-impact, low-to-medium effort changes that fix
confusing or missing core behaviors.

**1. Canvas-level slot creation.**

Add a "Add Slot" button to the canvas footer bar (in `LayoutBuilderCanvasPanel.tsx`,
next to the existing Zoom/Snap/MaxWidth controls). On click, call `builder.addSlot()`
and center the new slot on the canvas viewport.

Additionally, enable **double-click on canvas background** to create a slot at that
position. The `handleCanvasDblClick` handler in `LayoutCanvas.tsx` currently only resets
zoom — extend it: if `onMediaCanvasDrop` is available, create a new slot at the clicked
position.

```tsx
// In LayoutBuilderCanvasPanel.tsx footer:
<Button size="xs" variant="subtle" leftSection={<IconPlus size={12} />}
  onClick={() => {
    const id = builder.addSlot();
    builder.selectSlot(id);
    announce('New slot added');
  }}
>
  Add Slot
</Button>
```

**2. Properties panel — canvas-level defaults when nothing selected.**

Replace the empty state in `LayoutBuilderPropertiesPanel.tsx` with a composite view:

```
┌─ CANVAS ─────────────────────────┐
│ Background: [Color ▸]            │
│ Aspect:    [16:9 ▸]              │
│ Max Width: [1200 px]             │
│ ───────────────────────────────  │
│ Quick Add                        │
│ [＋ Add Slot]  [＋ Add Graphic]  │
│ ───────────────────────────────  │
│ Recent Actions                   │
│ • Move slot 3 ago                │
│ • Add overlay 12 ago             │
│ • Resize slot 18 ago             │
└──────────────────────────────────┘
```

- Background quick-pick: maps to `builder.setBackgroundMode()` and selects the
  Background in the Layers panel
- Aspect ratio: same `SegmentedControl` currently in the header (enables removal from
  header — see item 26)
- Max width: `NumberInput` bound to `canvasMaxWidth`
- Quick Add buttons: `builder.addSlot()`, `builder.addOverlay()` with a default asset
- Recent Actions: last 3 entries from `builder.historyEntries` (enables eventual removal
  of the History dock tab — see item 28)

**3. Multi-select in Layers panel.**

Add Ctrl/Cmd+click and Shift+click support to `LayerRow.tsx` / `LayerPanel.tsx`:

- On row click, check `e.ctrlKey` / `e.metaKey` → toggle selection (add/remove from
  `selectedSlotIds`)
- Track last clicked index; on Shift+click, select all rows between last and current
- Update `onSelect` callback to use `builder.toggleSlotSelection()` for Ctrl+click and
  a new `selectRangeSlots(fromId, toId)` action in `useLayoutBuilderState`
- Visual: selected rows already have the blue left-border + bg style

**4. Fix duplicate shortcut: Ctrl+V → Ctrl+D.**

In `LayoutBuilderModal.tsx` `handleKeyDown`:

```diff
- if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
+ if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      handleDuplicateSelected();
      e.preventDefault();
    }
```

Update `BuilderKeyboardShortcutsModal.tsx` to show `Ctrl/⌘ + D` instead of `Ctrl/⌘ + V`.

Optionally implement proper copy/paste (Ctrl+C copies slot data to internal clipboard
state, Ctrl+V pastes it) as a follow-on, but Ctrl+D for duplicate is the minimum fix.

**5. Visual indicator for locked slots on canvas.**

In `LayoutSlotComponent.tsx`, when `slot.locked` is true, render a small lock icon
overlay (similar to the index badge) in the top-right corner:

```tsx
{(slot.locked ?? false) && (
  <div style={{
    position: 'absolute', top: 4, right: 4,
    background: 'rgba(0,0,0,0.6)', color: '#fff',
    borderRadius: '50%', width: 18, height: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: 3,
  }}>
    <IconLock size={10} />
  </div>
)}
```

Also dim the resize handles when locked (they already disappear via
`enableResizing={!locked}` but the handle opacity transition is not obvious).

**Files affected:**

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | Add "Add Slot" button to footer |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | Extend `handleCanvasDblClick` for slot creation |
| `src/components/Admin/LayoutBuilder/LayoutBuilderPropertiesPanel.tsx` | Replace empty state with canvas-level defaults view |
| `src/components/Admin/LayoutBuilder/LayerRow.tsx` | Ctrl+click / Shift+click multi-select |
| `src/components/Admin/LayoutBuilder/LayerPanel.tsx` | Pass multi-select handlers |
| `src/hooks/useLayoutBuilderState.ts` | Add `selectRangeSlots` action |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Change duplicate shortcut to Ctrl+D |
| `src/components/Admin/LayoutBuilder/BuilderKeyboardShortcutsModal.tsx` | Update shortcut documentation |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | Lock icon overlay on canvas |

**Acceptance criteria:**

- Clicking "Add Slot" in canvas footer creates a new slot centered on the viewport. ( )
- Double-clicking canvas background creates a slot at click position. ( )
- Properties panel shows canvas-level controls and recent actions when nothing is
  selected. ( )
- Ctrl+click on layer rows toggles multi-selection; Shift+click selects range. ( )
- Duplicate uses Ctrl+D; Ctrl+V no longer triggers duplicate. ( )
- Locked slots show a lock icon overlay in the top-right corner on canvas. ( )

**Effort:** ~6-8 hours

---

#### P29-G-B — Properties Panel Reorganization & Media Improvements (P1)

**Scope:** Items 6, 11, 12, 13 above. Medium effort, high daily-use impact.

**6. Properties panel: tabbed or accordion layout.**

Restructure `SlotPropertiesPanel.tsx` from a single vertical scroll into an `<Accordion>`
with 4 groups:

| Accordion Item | Contains |
|---------------|----------|
| **Layout** | Name, Position (X/Y), Size (W/H + aspect lock), Shape (preset + custom clip-path) |
| **Image** | Fit (object-fit), Focal Point (3×3 grid + custom), Border (radius, width, color) |
| **Effects** | Filters (all 8 sliders), Shadow (enable, offset, blur, color), Blend Mode, Overlay (darken/lighten), 3D Tilt |
| **Stacking & Interaction** | Z-Index + reorder buttons, Click action, Hover effect + glow config |

The accordion defaults to all-open (preserving current behavior) but allows users to
collapse sections they're not working with. Uses the existing `PropRow` and
`SectionHeader` components — only the wrapper structure changes.

**11. Media picker search.**

Add a `<TextInput>` with a search icon above the media list in `MediaPickerSidebar.tsx`.
Filter the displayed media items client-side:

```tsx
const [searchQuery, setSearchQuery] = useState('');
const filteredMedia = useMemo(() =>
  media.filter(m =>
    !searchQuery ||
    m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.type?.toLowerCase().includes(searchQuery.toLowerCase())
  ),
  [media, searchQuery],
);
```

**12. Media picker: list/grid view toggle.**

Add a small segmented control or icon button pair next to the "Auto" button in
`MediaPickerSidebar.tsx`:

- List view (current): compact rows with 40×40 thumbnail, title, dimensions
- Grid view: 3-4 column grid with larger thumbnails (80×80), title overlay

Grid view uses CSS Grid with `gridTemplateColumns: repeat(auto-fill, minmax(90px, 1fr))`
and shows thumbnails in a more visual browsing layout.

**13. Auto-assign: dropdown with options.**

Replace the single "Auto" button in `MediaPickerSidebar.tsx` with a `<Menu>`:

```
[Auto ▾]
┌─────────────────────┐
│ Auto-fill (forward) │  ← current behavior, default
│ Auto-fill (reverse) │  ← reverse slot order
│ Shuffle & fill      │  ← Fisher-Yates shuffle before assign
│ Clear all assigns   │  ← clearSlotMedia for all slots
└─────────────────────┘
```

Implementation: add `reverseAssignMedia` and `shuffleAssignMedia` actions to
`useLayoutBuilderState` (or handle in the panel with array manipulation before calling
`autoAssignMedia`).

**Files affected:**

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx` | Wrap sections in Accordion with 4 groups |
| `src/components/Admin/LayoutBuilder/MediaPickerSidebar.tsx` | Add search input, list/grid toggle, auto-assign menu |
| `src/hooks/useLayoutBuilderState.ts` | Add `reverseAssignMedia`, `shuffleAssignMedia`, `clearAllMedia` actions |

**Acceptance criteria:**

- Properties panel is organized into 4 collapsible accordion sections. ( )
- All existing properties are accessible; no controls removed or renamed. ( )
- Accordion defaults to all-open on first render. ( )
- Media picker has a search input that filters by title, caption, and type. ( )
- Media picker has a list/grid view toggle. ( )
- Auto-assign button opens a dropdown with 4 options. ( )
- Shuffle produces different assignments on each click. ( )

**Effort:** ~5-7 hours

---

#### P29-G-C — Canvas Tooling Additions (P1/P2)

**Scope:** Items 7, 8, 9, 17 above. Medium-to-high effort, medium impact.

**7. Alignment and distribute tools.**

Add alignment buttons to the Layers panel toolbar (visible when 2+ slots are selected):

```
[⬅ Align Left] [Center ⟵] [Align Right ➡] [Distribute ↔]
[⬆ Align Top]  [Center ↑↓] [Align Bottom ⬇] [Distribute ↕]
```

Implementation in `LayoutBuilderLayersPanel.tsx`:

- Detect `builder.selectedSlotIds.size >= 2` to show/hide the alignment toolbar
- Compute alignment targets from the bounding box of all selected slots
- Apply `builder.updateSlot()` for each slot with computed X/Y or W/H values
- Use existing `builder.nudgeSlots` or direct `updateSlot` calls

Helper functions in a new `src/utils/alignSlots.ts`:

```ts
export function alignSlotsLeft(slots: LayoutSlot[]): Record<string, Partial<LayoutSlot>>;
export function alignSlotsHorizontally(slots: LayoutSlot[]): Record<string, Partial<LayoutSlot>>;
export function distributeSlotsHorizontally(slots: LayoutSlot[], canvasWidth: number): Record<string, Partial<LayoutSlot>>;
// ... etc for vertical
```

**8. Grouping feature.**

Add slot grouping (Ctrl+G / Ctrl+Shift+G) to `useLayoutBuilderState`:

- New `groups` array on `LayoutTemplate` (or as builder-local state): `{ id, slotIds,
  name }`
- Grouped slots share a transform origin; moving/resizing the group moves all members
  relative to their offsets
- In Layers panel, show groups as expandable parent rows with indented child slots
- Visual: grouped slots get a colored handle border (different from selection blue)

This is the highest-effort item in this track. Can be scoped down to "visual grouping
only" (select multiple, group them, they move together) without full transform-inheritance.

**9. Fit to Screen zoom.**

Add a "Fit" button next to the zoom % display in `LayoutBuilderCanvasPanel.tsx` footer.

Computes optimal scale:

```ts
const containerRect = canvasContainerRef.current?.getBoundingClientRect();
const fitScaleX = (containerRect.width - 48) / canvasWidth;  // 48px padding
const fitScaleY = (containerRect.height - 48) / canvasHeight;
const fitScale = Math.min(fitScaleX, fitScaleY, 1);
transformRef.current?.setTransform(0, 0, fitScale);
```

**17. Grid overlay with snap-to-grid.**

Add a toggle in the canvas footer (next to existing Snap toggle):

```
[Grid] [Cell: 20px ▾]  [Snap to Grid ☐]
```

- Grid overlay: CSS `background-image` with `linear-gradient` creating a dot or line
  grid pattern on the canvas background
- Snap-to-grid: on drag stop, round slot position/size to the nearest grid cell
- Cell size options: 10px, 20px, 25px, 50px

Implementation: add `gridEnabled`, `gridSize`, `snapToGrid` state to
`LayoutBuilderCanvasPanel`, pass to `LayoutCanvas` for rendering and snap computation.

**Files affected:**

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx` | Alignment toolbar (shown when 2+ selected) |
| `src/utils/alignSlots.ts` | **New file** — alignment/distribution computation helpers |
| `src/hooks/useLayoutBuilderState.ts` | Group CRUD actions, group-aware move/resize |
| `src/components/Admin/LayoutBuilder/LayerPanel.tsx` | Group rows in layer list |
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | Fit button, grid toggle + cell size selector |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | Grid overlay rendering, snap-to-grid on drag stop |

**Acceptance criteria:**

- Alignment toolbar appears when 2+ slots selected; 8 alignment options work correctly. ( )
- Groups can be created (Ctrl+G), expanded/collapsed in Layers panel, and moved as a unit. ( )
- "Fit" button zooms canvas to fit within viewport with padding. ( )
- Grid overlay renders on canvas; snap-to-grid rounds positions on drag stop. ( )
- Grid cell size is configurable (10/20/25/50px). ( )

**Effort:** ~10-14 hours (grouping is the bulk; alignment and grid are each ~2-3h)

---

#### P29-G-D — Feedback, Polish & Info (P2)

**Scope:** Items 15, 16, 18, 30, 31, 32 above. Low effort, incremental UX polish.

**15. Move unsaved indicator to template name.**

In `LayoutBuilderModal.tsx` header, add an unsaved dot next to the template name
TextInput:

```tsx
<Group gap={2} wrap="nowrap">
  {builder.isDirty && (
    <Box style={{ width: 8, height: 8, borderRadius: '50%',
      background: 'var(--mantine-color-yellow-5)', flexShrink: 0 }} />
  )}
  <TextInput value={builder.template.name} ... />
</Group>
```

Remove the `<Text size="xs" c="dimmed" fs="italic">Unsaved</Text>` from the right side.

**16. JSON import/export.**

Add two buttons to the header (or a template dropdown menu):

- **Export JSON:** `JSON.stringify(builder.template)` → `Blob` → `URL.createObjectURL`
  → trigger download as `{template-name}.wpsg-layout.json`
- **Import JSON:** `<input type="file" accept=".json">` → `FileReader` →
  `JSON.parse` → validate schema → `builder.setTemplate(imported, { preserveSelection: false })`

Validation: check required fields (`name`, `slots` array, `canvasAspectRatio`). Show
error notification on invalid JSON.

**18. Contextual floating toolbar (quick actions).**

When a slot is selected, render a small floating bar near the slot's top-center edge
(on the canvas, not the properties panel):

```
┌──────┬──────┬──────┬──────┐
│ ⧉ Dup│ 🗑 Del│ 🔲 Mask│ ⬡ Shape│
└──────┴──────┴──────┴──────┘
```

Position: computed from the slot's pixel position on canvas, rendered as an absolutely
positioned element in `LayoutSlotComponent.tsx` or as an overlay in `LayoutCanvas.tsx`.

This is a polish item — the same actions are all accessible via Layers panel toolbar
and keyboard shortcuts. The floating toolbar reduces clicks for frequent operations.

**30. Toast notifications for significant actions.**

Add `@mantine/notifications` provider (if not already present) and dispatch toasts for:

- Slot added / deleted / duplicated
- Media assigned / unassigned
- Overlay added / deleted
- Save success / failure
- Background changed

Replace or supplement the existing `announce()` (a11y-only) calls with
`notifications.show({ title, message, color, autoClose: 3000 })`.

**31. Draft restored message on reopen.**

In `LayoutBuilderModal.tsx`, when the modal opens and there's a draft in
`localStorage` (`wpsg_layout_draft_${template.id}`), show a toast:
`"Draft restored — you had unsaved changes from your last session."`

**32. Canvas dimensions as styled overlay.**

Replace the plain `<Text>` dimension label above the canvas in `LayoutCanvas.tsx` with
a styled pill/badge:

```
┌────────────────────────┐
│ 1200 × 675px · 16:9 · 3 slots │
└────────────────────────┘
```

Include aspect ratio display alongside dimensions.

**Files affected:**

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Unsaved dot, import/export buttons, draft restored toast |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | Floating quick-action toolbar (conditional render when selected) |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | Styled dimension badge with aspect ratio |
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | Toast notifications wrapper (if Notifications provider needed) |

**Acceptance criteria:**

- Unsaved dot appears next to template name; old "Unsaved" text removed. ( )
- Export downloads a valid JSON file; Import loads it and replaces current template. ( )
- Invalid JSON import shows error notification; does not corrupt current state. ( )
- Floating toolbar appears near selected slot; all 4 buttons work. ( )
- Toast notifications appear for add/delete/duplicate/assign/save actions. ( )
- Draft restored message appears when reopening with unsaved draft. ( )
- Canvas dimensions include aspect ratio display. ( )

**Effort:** ~4-6 hours

---

#### P29-G-E — Cleanup & Simplification (P2)

**Scope:** Items 25-29 above. Low effort, removes clutter.

**25. Remove "Save & Close" button.**

Remove the `<Button variant="light" onClick={handleSaveAndClose}>` from the header
right side. Users can Save then Close in two clicks. The dirty guard on Close already
prevents data loss.

One-liner removal from `LayoutBuilderModal.tsx`.

**26. Move aspect ratio selector from header to Properties panel.**

Remove the `SegmentedControl` for aspect ratio from the header center. Add it to the
canvas-level defaults view (item 2 above) or the canvas footer bar.

**27. Make slot index badges togglable.**

Add a switch in the canvas footer: `Show indices` (default: on). Pass as a prop through
to `LayoutSlotComponent` to conditionally render the index badge div.

**28. Collapse History into header dropdown.**

Remove the History dock tab. Instead, make the Undo button in the header open a dropdown
menu showing the last 10 history entries (from `builder.historyEntries`), with jump-to
and undo/redo actions. This eliminates the dedicated dock panel while keeping the feature
accessible.

```tsx
<Menu withinPortal>
  <Menu.Target>
    <ActionIcon onClick={builder.undo} disabled={!builder.canUndo}>
      <IconArrowBackUp size={18} />
    </ActionIcon>
  </Menu.Target>
  <Menu.Dropdown>
    {historyEntries.slice(-10).reverse().map(entry => (
      <Menu.Item onClick={() => builder.jumpToHistoryIndex(...)}>
        {entry.label}
      </Menu.Item>
    ))}
  </Menu.Dropdown>
</Menu>
```

**29. Move canvas height mode controls to Properties panel.**

Remove the SegmentedControl (Ratio/vh) and NumberInput (vh value) from the canvas
footer. Add them to the canvas-level defaults view in the Properties panel (item 2).

**Files affected:**

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Remove Save & Close, move aspect ratio, collapse History into dropdown |
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | Remove height mode controls, add "Show indices" toggle |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | Conditional index badge render |
| `src/components/Admin/LayoutBuilder/LayoutBuilderPropertiesPanel.tsx` | Add height mode + aspect ratio to canvas-level view |
| `src/components/Admin/LayoutBuilder/BuilderDockContext.tsx` | Remove `history` from dock components if History tab is removed |
| `src/components/Admin/LayoutBuilder/index.ts` | Remove `BuilderHistoryPanel` export if no longer used |

**Acceptance criteria:**

- "Save & Close" button is removed; Save and Close remain functional. ( )
- Aspect ratio control is in Properties panel or canvas footer, not header center. ( )
- Slot index badges can be toggled on/off. ( )
- History panel is removed as a dock tab; history is accessible via header dropdown. ( )
- Canvas height mode controls are in Properties panel. ( )
- Canvas footer is cleaner and less cluttered. ( )
- Header is less crowded. ( )

**Effort:** ~2-3 hours

---

### Execution Priority

1. **P29-G-A** (Critical fixes) — go first. These are independent, low-risk, and fix
   confusing or broken UX patterns.
2. **P29-G-B** (Properties + Media) — second. Depends on G-A item 2 (canvas-level
   Properties view) for the reorganized panel structure.
3. **P29-G-C** (Canvas tooling) — third. Alignment and grid are independent; grouping
   is the largest single effort item.
4. **P29-G-D** (Feedback & polish) — can run in parallel with G-C.
5. **P29-G-E** (Cleanup) — last. These removals make sense after the new features are
   in place (e.g., aspect ratio moves out of header only after it's available in the
   Properties panel).

### Nice-to-Have (Deferred to Future Phase)

| Item | Description | Why deferred |
|------|-------------|-------------|
| 10 | Ruler / measurement indicators | High effort for marginal gain; audit-only feature |
| 14 | Responsive preview (viewport width presets) | Requires significant canvas rendering changes |
| 19 | Slot templates / saved compositions | Requires new data model and persistence layer |
| 20 | Before/after comparison slider in preview | Nice-to-have; not a workflow blocker |
| 21 | Batch operations (apply filter to all selected) | Can be addressed after alignment tools land |
| 22 | Canvas background patterns | Low-impact visual polish |
| 23 | Slot presets (pre-configured layouts) | Requires template library; scope is a feature, not a fix |
| 24 | Touchscreen support (pinch-to-zoom, touch drag) | Requires comprehensive pointer-event audit; mobile is not the primary use case |

### Acceptance Criteria (Track-Level)

All sub-track acceptance criteria above must be met. Additionally:

- No regressions in existing `useLayoutBuilderState.test.ts` test suite. ( )
- No regressions in existing LayoutBuilder component tests. ( )
- All keyboard shortcuts documented in `BuilderKeyboardShortcutsModal` are accurate.
  ( )
- A11y: all new interactive elements have aria-labels; a11y announcements (`announce()`)
  are preserved for new actions. ( )
- Dockview layout persistence (localStorage) is not broken by tab removals. ( )

### Total Effort Estimate

| Sub-track | Hours |
|-----------|-------|
| P29-G-A (Critical fixes) | 6-8 |
| P29-G-B (Properties + Media) | 5-7 |
| P29-G-C (Canvas tooling) | 10-14 |
| P29-G-D (Feedback & polish) | 4-6 |
| P29-G-E (Cleanup) | 2-3 |
| **Total** | **27-38 hours** |

---

## Validation

- Live API: `GET /campaigns/89/media` after deploy → 9/10 items assigned fresh UUIDs.
- `DELETE /campaigns/89/media/89` → 200, 9 items remain.
- `DELETE /campaigns/89/media/{uuid}` → 200, 8 items remain.

---

## Files Affected

| File | Change |
|------|--------|
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Route regex, custom-ID validation regex, `delete_media` validation + guard, `list_media` ID backfill |
| `src/hooks/useUnifiedCampaignModal.ts` | `handleRemoveMedia` guard + `encodeURIComponent` |
| `wp-plugin/wp-super-gallery/tests/WPSG_REST_Routes_Test.php` | Updated regex patterns; added UUID and hyphenated IDs to valid test cases |
| `src/components/Admin/TemplatesTab.tsx` | Added `description` Textarea and state to Create Template modal |
| `src/components/Admin/TemplatesTab.test.tsx` | Updated `createCampaignTemplate` assertion to include `description` |
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` | Switched from CSS Grid to Flexbox layout engine |
| `src/components/Galleries/Adapters/__tests__/adapters.test.tsx` | Updated DOM query to match flex-wrap container |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | `create_media`: removed `'id'` from param-copy loop; `list_media`: extended backfill to repair duplicate IDs |

---

## Outcome

- Five tracks shipped: P29-A, P29-B, P29-C, P29-D, P29-E (all complete ✅).
- P29-F (Settings Panel tab re-grouping) planned — analysis complete, implementation pending.
- P29-G (LayoutBuilder UX audit) planned.
- Deferred from P29-E: Analytics chart height reduction on mobile (low impact, no complaints).
- Follow-on to consider: audit whether `rescan_all_media_types` and other
  functions that call `update_post_meta('media_items', ...)` are similarly
  exposed to the `sanitize_media_items` drop-on-no-id behaviour — those paths
  could wipe IDs if called on data that hasn't been backfilled yet.

---

## Track P29-H — Shared Grid Layout Engine

### Problem

`CardGallery` (the main campaign listing viewer at `src/components/CampaignGallery/CardGallery.tsx`)
and `CompactGridGallery` (the modular adapter at
`src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx`) both implement
nearly identical flex-wrap grid layout engines, but with different data models and feature sets.

**Duplicated layout logic (~110 lines of near-duplicate code across two files):**

| Concern | CardGallery | CompactGridGallery |
|---------|-------------|-------------------|
| Column calculation | `effectiveColumns` + `maxCols` (resolve `cardGridColumns`, `cardMaxColumns`, `cardAutoColumnsBreakpoints`, container width via `resolveColumnsFromWidth`) | `maxColumns` from `gridCardMaxColumns` (0-8 clamped) |
| Fixed-width branch | `fixedCardWidth` computation with `MIN_FIXED_CARD_WIDTH_PX = 120` floor, scale application, percentage-to-pixel resolution, fallback to responsive | `cardWidth` from `gridCardWidth` × `itemScale`, `cardWidthUnit` |
| Grid maxWidth cap | `calc(N × width + (N-1) × gap)` with `marginInline: 'auto'` | Same pattern: `min(100%, calc((width × N) + gap × (N-1)))` |
| Responsive width calc | `calc((100% - totalGap) / columns)` | `min(width, calc(50% - gap/2))` (via flexBasis) |
| Gap handling | Row/column gap with unit support, percentage gap clamped to ≥4px minimum | Single gap value with unit |
| Breakpoint resolution | `useBreakpoint(gridContainerRef)` → `resolveCardBreakpointSettings()` | `containerDimensions` prop (passed from `GallerySectionWrapper`) |
| Justification | `cardGridJustification` → `justifyContent` | `common.adapterJustifyContent` → `justifyContent` |

**Why they can't share the same component:**

The two components solve fundamentally different problems:

| Aspect | CardGallery | CompactGridGallery |
|--------|-------------|-------------------|
| Data model | `Campaign[]` | `MediaItem[]` |
| Card content | Rich card with thumbnail, title, description, tags, company badge, media counts, access state, request access form | Thumbnail + hover overlay (play/zoom icon) |
| Click action | Opens `CampaignViewer` modal (full campaign detail with galleries) | Opens `Lightbox` (single image/video carousel) |
| Above-grid features | Filter tabs, search, pagination (load-more/paginated/show-all), access modes, admin in-context editing, header with title/subtitle/background | Gallery heading with icon, lightbox |
| Responsibility | Full-page viewer with header, filters, grid, pagination, modal | Adapter component within a `GallerySectionWrapper` |

Forcing CardGallery into the adapter system would require either making adapters accept
arbitrary item types (breaking the clean `MediaItem[]` contract) or converting campaigns
to media-item wrappers (adding unnecessary indirection).

**The real waste is the grid layout math**, not the card rendering or click handlers.

### Proposed Solution

**Option A (Primary — implement now):** Extract the shared grid layout logic into a reusable
hook that both components consume. The hook returns computed layout values; each component
applies them to its own card rendering logic.

**Option B (Investigate for future phase):** Make `CompactGridGallery` a generic grid
shell that accepts a `renderItem` prop, allowing CardGallery to delegate the grid container
and column wrapping to the adapter. This would require bridging the type gap and extracting
CardGallery's above-grid features (filters, search, pagination) into separate wrapper
components.

---

### Option A — Shared Grid Layout Hook (Primary Implementation)

#### What to Extract

From `CardGallery.tsx`, extract these pure computations:

1. **Effective column resolution.** The chain: `cardGridColumns` → `cardMaxColumns` clamp →
   `cardAutoColumnsBreakpoints` → `resolveColumnsFromWidth(containerWidth)` → final column count.
2. **Fixed-width resolution with floor.** `cardMaxWidth` × `cardScale` → percentage-to-pixel
   resolution → `MIN_FIXED_CARD_WIDTH_PX` (120px) floor → fallback to responsive branch.
3. **Grid maxWidth calculation.** `calc(N × width + (N-1) × gap)` for fixed-width grids.
4. **Responsive width calculation.** `calc((100% - totalGap) / columns)` for fluid grids.
5. **Percentage gap clamping.** Percentage-based gaps resolved below 4px minimum.

From `CompactGridGallery.tsx`, extract:

1. **Max columns clamping.** `gridCardMaxColumns` (0-8 range).
2. **Grid maxWidth calculation.** Same pattern as CardGallery.

#### Hook API

```ts
// src/hooks/useGridLayout.ts

interface UseGridLayoutInput {
  /** Container width from useBreakpoint or containerDimensions. */
  containerWidth: number;
  /** Explicit column count (0 = auto-resolve from container). */
  columns: number;
  /** Maximum columns to cap auto-resolution (0 = unlimited). */
  maxColumns: number;
  /** Auto-columns breakpoints config (optional, CardGallery-specific). */
  autoColumnsBreakpoints?: CardAutoColumnsBreakpoints;
  /** Fixed card width (0 = responsive/fluid). */
  cardWidth: number;
  /** Unit for fixed card width. */
  cardWidthUnit: CssWidthUnit;
  /** Scale multiplier for card dimensions. */
  scale: number;
  /** Horizontal gap value. */
  gapH: number;
  /** Unit for horizontal gap. */
  gapHUnit: CssWidthUnit;
  /** Vertical gap value. */
  gapV: number;
  /** Unit for vertical gap. */
  gapVUnit: CssWidthUnit;
  /** Minimum pixel width below which fixed cards fall back to responsive. */
  minFixedWidthPx?: number; // default: 120
}

interface GridLayoutResult {
  /** Resolved column count. */
  columns: number;
  /** Whether to use fixed-width or responsive cards. */
  isFixed: boolean;
  /** Fixed card width in resolved unit (only when isFixed is true). */
  fixedWidth: { value: number; unit: CssWidthUnit } | null;
  /** Responsive card width CSS string (only when isFixed is false). */
  responsiveWidth: string;
  /** Grid maxWidth CSS string (for centering fixed-width grids). */
  gridMaxWidth: string | undefined;
  /** Horizontal gap CSS string (with percentage clamping). */
  gapH: string;
  /** Vertical gap CSS string. */
  gapV: string;
}

export function useGridLayout(input: UseGridLayoutInput): GridLayoutResult;
```

#### Implementation Plan

**Step 1 — Create `src/hooks/useGridLayout.ts`.**

Extract the layout math into pure, memoized computations. The hook uses `useMemo` internally
so results are stable across renders when inputs haven't changed.

```ts
import { useMemo } from 'react';
import { toCss, toCssOrNumber, type CssWidthUnit } from '@/utils/cssUnits';
import { resolveColumnsFromWidth } from '@/utils/resolveColumnsFromWidth';

// ... (interface definitions above)

const DEFAULT_MIN_FIXED_WIDTH_PX = 120;

export function useGridLayout({
  containerWidth,
  columns,
  maxColumns,
  autoColumnsBreakpoints,
  cardWidth,
  cardWidthUnit,
  scale,
  gapH,
  gapHUnit,
  gapV,
  gapVUnit,
  minFixedWidthPx = DEFAULT_MIN_FIXED_WIDTH_PX,
}: UseGridLayoutInput): GridLayoutResult {
  return useMemo(() => {
    // 1. Resolve effective columns
    const effectiveColumns = columns > 0
      ? columns
      : (() => {
          const auto = containerWidth > 0
            ? resolveColumnsFromWidth(containerWidth, 0, autoColumnsBreakpoints)
            : 1;
          return maxColumns > 0 ? Math.min(auto, maxColumns) : auto;
        })();

    // 2. Resolve fixed width
    const hasFixedWidth = cardWidth > 0;
    const scaledWidth = scale !== 1 ? Math.round(cardWidth * scale) : cardWidth;

    const fixedWidth = hasFixedWidth
      ? (() => {
          if (cardWidthUnit === '%' && containerWidth > 0) {
            const resolved = Math.round((containerWidth * scaledWidth) / 100);
            if (resolved < minFixedWidthPx) return null;
            return { value: resolved, unit: 'px' as CssWidthUnit };
          }
          if (cardWidthUnit === 'px' && scaledWidth < minFixedWidthPx) return null;
          return { value: scaledWidth, unit: cardWidthUnit };
        })()
      : null;

    // 3. Gap resolution
    const gapHResolved = gapHUnit === '%' && containerWidth > 0 && (containerWidth * gapH / 100) < 4
      ? '4px'
      : toCss(gapH, gapHUnit);
    const gapVResolved = toCss(gapV, gapVUnit);

    // 4. Grid maxWidth for fixed-width centering
    const gridMaxWidth = fixedWidth
      ? `calc(${toCss(effectiveColumns * fixedWidth.value, fixedWidth.unit)} + ${effectiveColumns - 1} * ${gapHResolved})`
      : undefined;

    // 5. Responsive width
    const responsiveWidth = effectiveColumns <= 1
      ? '100%'
      : `calc((100% - ${toCss((effectiveColumns - 1) * gapH, gapHUnit)}) / ${effectiveColumns})`;

    return {
      columns: effectiveColumns,
      isFixed: fixedWidth !== null,
      fixedWidth,
      responsiveWidth,
      gridMaxWidth,
      gapH: gapHResolved,
      gapV: gapVResolved,
    };
  }, [
    containerWidth, columns, maxColumns, autoColumnsBreakpoints,
    cardWidth, cardWidthUnit, scale,
    gapH, gapHUnit, gapV, gapVUnit,
    minFixedWidthPx,
  ]);
}
```

**Step 2 — Refactor `CardGallery.tsx` to use `useGridLayout`.**

Replace the inline layout computations with a single hook call:

```tsx
// Replace effectiveColumns, maxCols, fixedCardWidth, responsiveCardWidth, effectiveGapH with:
const layout = useGridLayout({
  containerWidth,
  columns: s.cardGridColumns,
  maxColumns: s.cardMaxColumns,
  autoColumnsBreakpoints: s.cardAutoColumnsBreakpoints,
  cardWidth: s.cardMaxWidth,
  cardWidthUnit: s.cardMaxWidthUnit,
  scale: s.cardScale ?? 1,
  gapH: s.cardGapH,
  gapHUnit,
  gapV: s.cardGapV,
  gapVUnit,
});
```

Then update the grid rendering to use `layout.columns`, `layout.isFixed`,
`layout.fixedWidth`, `layout.responsiveWidth`, `layout.gridMaxWidth`,
`layout.gapH`, `layout.gapV`.

**Step 3 — Refactor `CompactGridGallery.tsx` to use `useGridLayout`.**

```tsx
const layout = useGridLayout({
  containerWidth: containerDimensions?.width ?? 0,
  columns: 0, // auto-resolve
  maxColumns: Math.max(0, Math.min(8, settings.gridCardMaxColumns ?? 0)),
  cardWidth: settings.gridCardWidth ?? 160,
  cardWidthUnit: settings.gridCardWidthUnit ?? 'px',
  scale: settings.itemScale ?? 1,
  gapH: common.adapterItemGap ?? 16,
  gapHUnit: common.adapterItemGapUnit ?? 'px',
  gapV: common.adapterItemGap ?? 16,
  gapVUnit: common.adapterItemGapUnit ?? 'px',
});
```

**Step 4 — Write tests.**

Create `src/hooks/useGridLayout.test.ts` with cases for:

- Responsive mode (cardWidth = 0): correct column auto-resolution, correct responsive width calc
- Fixed mode (cardWidth > 0, px): correct grid maxWidth, fixed width application
- Fixed mode (cardWidth > 0, %): percentage-to-pixel resolution, floor fallback
- Scale application: `scale ≠ 1` correctly scales card width
- Gap clamping: percentage gaps below 4px resolve to '4px'
- Edge cases: 0 container width, 0 columns, 0 maxColumns, single column
- Stability: same inputs produce same memoized result (reference equality)

**Files affected:**

| File | Change |
|------|--------|
| `src/hooks/useGridLayout.ts` | **New file** — shared grid layout hook |
| `src/hooks/useGridLayout.test.ts` | **New file** — hook tests |
| `src/components/CampaignGallery/CardGallery.tsx` | Replace inline layout math with `useGridLayout` call |
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` | Replace inline layout math with `useGridLayout` call |

**Acceptance criteria:**

- `useGridLayout` returns correct column count, width mode, and gap values for all test cases. ( )
- CardGallery renders identically to current behavior; no visual regression. ( )
- CompactGridGallery renders identically to current behavior; no visual regression. ( )
- Both components produce identical grid layouts when given equivalent inputs. ( )
- No regressions in existing `CardGallery.test.tsx` or `adapters.test.tsx`. ( )
- `useGridLayout` results are memoized (reference-stable) when inputs are unchanged. ( )
- Percentage gap clamping works correctly (gaps resolving to < 4px become '4px'). ( )
- Fixed-width floor fallback works (cards below `minFixedWidthPx` fall back to responsive). ( )

**Effort:** ~4-6 hours

---

### Option B — Generic Grid Shell (Investigation for Future Phase)

#### Premise

If the grid layout is shared via `useGridLayout`, the next step would be sharing the grid
container itself — the flex-wrap `<Box>` with `justifyContent`, `gap`, `maxWidth`, and
the per-card wrapper `<Box>` with `flexBasis`/`maxWidth`.

This would turn `CompactGridGallery` (or a new `FlexGrid` component) into a generic grid
shell that CardGallery could delegate to, eliminating the duplicated container markup.

#### Type Bridging Problem

CardGallery works with `Campaign[]`; the adapter system expects `MediaItem[]`. Three approaches:

**B1 — `renderItem` prop (React pattern).**

Make the grid shell accept any item type via generics and a render function:

```tsx
// Conceptual API:
<FlexGrid<Campaign>
  items={visibleCampaigns}
  layout={layout}
  renderItem={(campaign, index) => <CampaignCard campaign={campaign} ... />}
/>
```

This is the cleanest approach. The grid shell knows nothing about item types — it only
handles layout. The card rendering is entirely delegated.

**Risk:** CardGallery's cards have different wrapper requirements than CompactGridGallery's.
CardGallery wraps responsive cards in a sizing `<Box>` with `flex: 0 0 width` and `minWidth: 0`.
CompactGridGallery uses `flexBasis: min(width, calc(50% - gap/2))`. These are slightly
different sizing strategies, and a unified shell would need to parameterize this.

**B2 — Wrapper type (adapter pattern).**

Create a thin wrapper that converts `Campaign` to an adapter-compatible shape:

```ts
interface GridItem {
  id: string;
  render: () => ReactNode;
}
```

CardGallery maps campaigns to `{ id: campaign.id, render: () => <CampaignCard ... /> }`.

**Risk:** Adds indirection and a new abstraction layer. The render-in-closure pattern
is less testable and harder to debug than direct JSX.

**B3 — Keep separate, share only the hook.**

Don't pursue Option B. The layout hook (Option A) captures the actual duplication.
The container markup is ~15 lines each and not particularly complex. Sharing it would
save tokens but add cognitive overhead from abstraction.

#### Feature Mismatch Problem

CardGallery has features that are structurally different from any adapter:

- **Pagination:** slide animation with `transitionend` observers, page state, direction tracking
- **Load-more:** visible count state, "Load more" button
- **Filter/search:** tab-based company filter, text search, access mode filtering
- **Admin controls:** in-context editors, access mode toggle

These are all *above* the grid — they filter and paginate the data *before* it reaches
the grid. A generic grid shell doesn't help with these.

#### Investigation Tasks

Before committing to Option B in a future phase, investigate:

1. **How many other adapters would benefit?** Check `MasonryGallery`, `CircularGallery`,
   `JustifiedGallery` — do they also have hand-rolled grid math, or do they already use
   specialized layout algorithms? If only CompactGrid and CardGallery share this pattern,
   Option A is sufficient.

2. **Can CardGallery's grid rendering be extracted to a sub-component without
   refactoring the parent?** Try extracting just the `<Box>` grid section (lines ~280-340
   of CardGallery.tsx) into `<CampaignCardGrid>` and measure the complexity gain vs. the
   duplication saved.

3. **Does the `renderItem` pattern work with CardGallery's fixed vs. responsive card
   branching?** CardGallery conditionally wraps cards differently based on `fixedCardWidth`.
   This branching logic would need to live inside the grid shell or be parameterized.

4. **Would a shared grid shell make it easier to swap adapters for CardGallery?** If a
   future requirement is "let users choose the campaign listing layout (compact grid,
   masonry, etc.)", a shared grid shell would be foundational. If this requirement is
   unlikely, Option A is the right stopping point.

#### Recommendation

**Implement Option A now.** Option B should be revisited only if:
- A future phase requires user-selectable campaign listing layouts, or
- More than 2 additional adapters are found to have the same grid duplication,
- The CardGallery grid section grows significantly more complex (new layout modes, etc.)

The investigation tasks above should be documented in a future phase report as a
preliminary track if Option B is being considered.

### Acceptance Criteria (Track-Level)

- Option A hook is implemented, tested, and adopted by both CardGallery and CompactGridGallery. ( )
- No visual regressions in either component. ( )
- All existing tests pass. ( )
- Option B investigation tasks are documented and filed for future consideration. ( )

### Effort Estimate

| Item | Hours |
|------|-------|
| Option A: Create `useGridLayout` hook | 2-3 |
| Option A: Test the hook | 1-2 |
| Option A: Refactor CardGallery | 1-1.5 |
| Option A: Refactor CompactGridGallery | 0.5-1 |
| Option B: Investigation tasks (1-4) | 1-2 |
| **Total** | **5.5-9.5 hours** |

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/hooks/useGridLayout.ts` | **New file** — shared grid layout hook |
| `src/hooks/useGridLayout.test.ts` | **New file** — hook tests |
| `src/components/CampaignGallery/CardGallery.tsx` | Replace inline layout math with `useGridLayout` |
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` | Replace inline layout math with `useGridLayout` |
| `src/components/CampaignGallery/CardGallery.test.tsx` | Update selectors if DOM structure changes |
| `src/components/Galleries/Adapters/__tests__/adapters.test.tsx` | Update selectors if DOM structure changes |
