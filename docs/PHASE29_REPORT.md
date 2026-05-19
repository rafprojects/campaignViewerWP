# Phase 29 — Bug Fixes & UI Increments

**Status:** Complete
**Created:** 2026-05-18
**Last updated:** 2026-05-18

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P29-A | Fix campaign media delete wiping all items | Complete ✅ | Small |
| P29-B | Add description field to Create Template modal | Complete ✅ | XS |
| P29-C | CompactGridGallery: switch CSS Grid → Flexbox | Complete ✅ | Small |
| P29-D | Fix campaign ID leaking into media item ID on add | Complete ✅ | Small |
| P29-E | Admin Panel mobile responsiveness (below 768px) | New | Large |

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

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Fix route regex or reject UUID-format IDs | Fix the regex — UUIDs are already in production data; the regex was simply too narrow. |
| B | Where to backfill missing IDs | Inside `list_media` on read, so legacy items are repaired automatically the first time the Media tab is opened — no separate migration script needed. |
| C | Grid layout engine for CompactGridGallery | Switch to `flex-wrap`; `auto-fit` grid distributes columns globally so `justifyContent` has no effect on the last row, while flex wrap distributes per row. |
| D | Remove `'id'` from the param-copy loop in `create_media` | The route `{id}` capture is the campaign post ID — removing it from the fallback loop means a missing body `id` field correctly falls through to `wp_generate_uuid4()` in `build_media_item_from_payload`. |

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
and is already tested.

#### P0 — Tab Navigation

Replace `<Tabs.List>` with an `<Accordion>` below `sm`. The accordion items map 1:1 to the
tab values; clicking an accordion item sets the active tab. At `sm` and above, render the
existing `<Tabs.List>`.

```tsx
// AdminPanel.tsx
{isMobile ? (
  <Accordion value={activeTab ?? 'campaigns'} onChange={setActiveTab}>
    <Accordion.Item value="campaigns">Campaigns</Accordion.Item>
    <Accordion.Item value="media">Media</Accordion.Item>
    <Accordion.Item value="layouts">Layouts</Accordion.Item>
    <Accordion.Item value="templates">Templates</Accordion.Item>
    <Accordion.Item value="access">Access</Accordion.Item>
    <Accordion.Item value="audit">Audit</Accordion.Item>
    <Accordion.Item value="globalAudit">Global Audit</Accordion.Item>
    <Accordion.Item value="analytics">Analytics</Accordion.Item>
  </Accordion>
) : (
  <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
    {/* existing tabs */}
  </Tabs.List>
)}
```

#### P0 — Tables to Cards (Campaigns, Access, Audit, Global Audit, Pending Requests)

For each table-heavy tab, provide a card-based mobile alternative. Each card represents one
row and shows the key information in a stacked layout with action buttons in a footer row.

**Campaigns card example:**
```
┌────────────────────────────┐
│ Campaign Title             │
│ 🟢 Active  🔒 Private  🏢 Acme │
│ Grants: 3                  │
│ ───────────────────────── │
│ [Edit] [Archive] [Delete]  │
└────────────────────────────┘
```

**Audit card example:**
```
┌────────────────────────────┐
│ May 18, 2026 14:32        │
│ action: campaign_created   │
│ by: admin@example.com      │
│ details: { ... }           │
└────────────────────────────┘
```

This replaces the table entirely below `sm`, keeping the table at `sm` and above.

#### P1 — Header Collapsing

Below `sm`, collapse "New Campaign", "Import", and keyboard shortcut into a single dropdown
menu button (⋯ icon or "Actions" label). Keep the back arrow and "Admin Panel" title visible.

#### P1 — Filter Bars to Collapsible Section

Wrap filter controls in a collapsible section (Mantine `<Accordion>` or `<details>` element).
On mobile show a summary chip like "Filters (2)" that expands the controls. At `sm` and above,
render filters inline as today.

#### P1 — Access Grant Form to Stacked Layout

Change the `<Group>` to `direction="column"` below `sm`. Remove all `minWidth` constraints
on inputs (they go full-width via `style={{ width: '100%' }}`). The combobox, Selects, datetime
input, and buttons all stack vertically.

#### P2 — BulkActionsBar Wrapping

Change `wrap="nowrap"` to `wrap="wrap"` on both inner Groups.

#### P2 — Layouts Grid Column Reduction

Below `sm`, use `gridTemplateColumns: '1fr'` (single column) or `minmax(160px)` instead of
`minmax(220px)`.

#### P2 — Templates Row Wrapping

Change `TemplateRow` Group from `wrap="nowrap"` to `wrap="wrap"` below `sm`.

### Acceptance criteria

- Tab navigation is usable on a 375px viewport without horizontal scrolling. ( )
- Campaigns tab renders as cards on mobile; each card shows title, status, visibility,
  company, and action buttons. ( )
- Access tab form controls stack vertically; no horizontal overflow at 375px. ( )
- Audit and Global Audit tabs render as cards on mobile. ( )
- Analytics stat cards remain in 2-column grid on mobile (already implemented). ( )
- No table renders a horizontal scrollbar on a 375px viewport. ( )
- All existing desktop and tablet layouts are unchanged. ( )
- `useBreakpoint` hook with `source: 'viewport'` is used for all responsive decisions
  (consistent with existing pattern in `useBreakpoint.test.tsx`). ( )
- No regressions in existing Vitest test suites. ( )

### Implementation Plan

**Step 1 — Shared mobile card components.** Create reusable `AdminCard` wrapper in
`src/components/Admin/AdminCard.tsx` for consistent card layout (header, body, footer
with action buttons).

**Step 2 — Tab navigation.** Add `<Accordion>` fallback in `AdminPanel.tsx`.

**Step 3 — Header.** Collapse action buttons into dropdown menu below `sm`.

**Step 4 — Campaigns cards.** Add card-based mobile view in `CampaignsTab.tsx`.

**Step 5 — Access tab.** Stack form controls, add card-based access entries.

**Step 6 — Audit/Global Audit cards.** Card-based mobile view for both tabs.

**Step 7 — PendingRequestsPanel cards.** Card-based mobile view.

**Step 8 — Layouts & Templates.** Grid column reduction, row wrapping.

**Step 9 — BulkActionsBar.** Change `wrap` behavior.

**Step 10 — Analytics.** Reduce chart height on mobile.

### Validation

- Manual QA: open Admin Panel in Chrome DevTools at 375px (iPhone SE), 390px (iPhone 14),
  and 414px (iPhone Plus). Verify no horizontal scroll on any tab.
- Manual QA: verify all 8 tabs are accessible via accordion at mobile breakpoint.
- Manual QA: verify desktop (1440px) and tablet (768px) layouts are unchanged.
- Vitest: ensure all existing tests pass; add snapshot or visual regression tests for
  mobile variants if feasible.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/AdminPanel.tsx` | Tab list → Accordion on mobile; header collapsing |
| `src/components/Admin/AdminCard.tsx` | **New file** — reusable mobile card component |
| `src/components/Admin/CampaignsTab.tsx` | Table → card list on mobile |
| `src/components/Admin/AccessTab.tsx` | Stacked form; table → cards on mobile |
| `src/components/Admin/AuditTab.tsx` | Table → cards on mobile; collapsible filters |
| `src/components/Admin/GlobalAuditTab.tsx` | Table → cards on mobile; collapsible filters |
| `src/components/Admin/PendingRequestsPanel.tsx` | Table → cards on mobile |
| `src/components/Admin/LayoutTemplateList.tsx` | Grid column reduction; collapsible toolbar |
| `src/components/Admin/TemplatesTab.tsx` | Row wrapping on mobile |
| `src/components/Admin/BulkActionsBar.tsx` | Change `wrap="nowrap"` → `wrap="wrap"` |
| `src/components/Admin/AnalyticsDashboard.tsx` | Chart height reduction on mobile |
| `src/components/Admin/MediaTab.tsx` | Campaign selector full-width on mobile; toolbar stacking |

### Effort Estimate

~15-20 hours of focused work across 12 files. The core pattern (table → card swap via
`useBreakpoint`) repeats across 6-7 tabs, so after the first 2-3 are done the remaining
ones are mechanical replication. The most complex work is the Access tab (form stacking +
context info reflow) and Campaigns tab (card layout with all the metadata and action buttons).

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

- Four tracks shipped: P29-A, P29-B, P29-C, P29-D (all complete).
- Nothing deferred.
- Follow-on to consider: audit whether `rescan_all_media_types` and other
  functions that call `update_post_meta('media_items', ...)` are similarly
  exposed to the `sanitize_media_items` drop-on-no-id behaviour — those paths
  could wipe IDs if called on data that hasn't been backfilled yet.
