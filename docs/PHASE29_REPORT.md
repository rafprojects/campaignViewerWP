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
| P29-E | Admin Panel mobile responsiveness (below 768px) | In Progress | Large |
| P29-F | Settings Panel: intuitive tab re-grouping | Planned | Medium |

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

**Step 1 — Trivial wrapping fixes.** `BulkActionsBar` `wrap="nowrap"` → `wrap="wrap"`;
`TemplatesTab` `TemplateRow` same change. Zero risk, immediate win.

**Step 2 — Audit table horizontal scroll.** Wrap both audit tab tables in
`<Table.ScrollContainer>`. One-liner per table, no behaviour change.

**Step 3 — Access table horizontal scroll.** Same treatment for Current Access table and its
loading skeleton.

**Step 4 — Tab navigation Select.** Add `useBreakpoint` (`source: 'viewport'`) to
`AdminPanel.tsx`. Below `sm`, render a `<Select>` that drives `setActiveTab`; at `sm+`, keep
the existing `<Tabs.List>`.

**Step 5 — Campaigns mobile card list.** Create `CampaignsMobileList.tsx`. `AdminPanel`
renders it instead of `<CampaignsTab>` when `isMobile`.

**Step 6 — Access grant form mobile stacking.** Pass `isMobile` to `AccessTab`; on mobile,
remove `minWidth` constraints and set `width: '100%'` on each grant-form input.

**Step 7 — Layouts grid mobile.** Add `useBreakpoint` to `LayoutTemplateList`; switch to
`gridTemplateColumns: '1fr'` below `sm`.

**Step 8 — Analytics chart height.** Reduce `ResponsiveContainer` height on mobile.

**Step 9 — (P2) Header collapse + filter Collapse toggle.** Deferred post-validation.

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
Media" into three focused tabs and moving operational settings to System.

| New Tab | Sections (Accordion Items) | Estimated Setting Count | Source Components |
|---------|---------------------------|------------------------|-------------------|
| **1. Appearance** | Theme & Layout, Page Container, Page Background, Page Header, Auth Bar | ~30 | `GeneralSettingsSection` (re-parented accordion items) |
| **2. Cards** | Card Appearance, Card Grid & Pagination, Card Internals | ~55 | `CampaignCardSettingsSection` (unchanged) |
| **3. Gallery Layout** | Gallery Adapters, Section Sizing & Spacing, Adapter Sizing, Carousel Settings | ~35 | `GalleryLayoutSettingsSection`, `GalleryLayoutDetailSections`, `GalleryAdapterSettingsSection` |
| **4. Gallery Style** | Viewport & Layout (lightbox toggle, viewport dimensions, border radius, shadows), Tile Appearance, Viewport Backgrounds, Transitions | ~45 | `MediaDisplaySettingsSection` (viewport, tile-appearance, transitions), `GalleryPresentationSections` |
| **5. Gallery Navigation** | Navigation (arrows, dots, scroll), Thumbnail Strip | ~25 | `MediaDisplaySettingsSection` (navigation, thumbnail-strip) |
| **6. Campaign Viewer** | Open Mode & Sizing, Modal Appearance, Content Visibility, Gallery Labels, Modal Background, Cover Image & Responsive | ~40 | `CampaignViewerSettingsSection` (unchanged) |
| **7. Typography** | Font Library Manager, 16 element overrides | ~16 | `TypographySettingsSection` (unchanged) |
| **8. System** *(hidden behind `advancedSettingsEnabled`)* | Magic Link Page Selector, Settings Drawer, Upload/Media, Tile/Adapter, Lightbox, Navigation, System, Developer & Debugging, Data Maintenance, Security & Login | ~60 | `AdvancedSettingsSection` + `Security & Login` moved from General |

**Key changes:**

- Split "Gallery & Media" (~90 settings) into 3 focused tabs: Gallery Layout (~35),
  Gallery Style (~45), Gallery Navigation (~25).
- Move "Security & Login" accordion from `GeneralSettingsSection` to `AdvancedSettingsSection`
  in the System tab.
- Keep all existing accordion section components unchanged — they are already well-scoped
  internally. Only the tab-level re-parenting changes.
- Total goes from 6 to 7 visible tabs (+ 1 hidden), but each tab is now 16-60 settings
  instead of 16-90, making everything findable in 1-2 clicks.

### Fix

All changes are in `SettingsPanel.tsx`. No accordion section components need modification.

**Step 1 — Rename and restructure tabs.**

Replace the existing tab definitions with the new structure:

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
  <Tabs.Tab value="gallery-style" leftSection={<IconAdjustments size={16} />}>
    Gallery Style
  </Tabs.Tab>
  <Tabs.Tab value="gallery-navigation" leftSection={<IconEye size={16} />}>
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

Move accordion items between tabs. The component imports and props remain identical.

- "Appearance" tab: Render `GeneralSettingsSection` but exclude the "Security & Login"
  accordion item (handled in Step 3).
- "Gallery Layout" tab: Render `GalleryLayoutSettingsSection` (already contains Gallery
  Adapters, Viewport Backgrounds, Carousel, Section Sizing, Adapter Sizing).
- "Gallery Style" tab: Render a subset of `MediaDisplaySettingsSection` — specifically
  the accordion items with values `viewport`, `tile-appearance`, `transitions`, plus
  `GalleryPresentationSections`.
- "Gallery Navigation" tab: Render a subset of `MediaDisplaySettingsSection` — specifically
  the accordion items with values `navigation`, `thumbnail-strip`.

**Step 3 — Move "Security & Login" to System tab.**

In `GeneralSettingsSection.tsx`, extract the accordion item with value `gen-security`
(Security & Login) into a separate component or render it conditionally in the System tab.
Two approaches:

- **Option A (preferred):** Extract `<Accordion.Item value="gen-security">...</Accordion.Item>`
  into a standalone `SecuritySettingsSection` component. Render it inside the System tab
  alongside `AdvancedSettingsSection`.
- **Option B:** Pass a prop to `GeneralSettingsSection` to exclude the security accordion
  item, and duplicate the accordion item in the System tab.

Option A is cleaner — it avoids duplication and keeps each accordion section in exactly
one location.

**Step 4 — Update default active tab.**

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
| `system-admin` | `system-admin` | Unchanged (now includes Security & Login) |
| `typography` | `typography` | Unchanged |

**`MediaDisplaySettingsSection.tsx` — Splitting strategy:**

Currently this component renders all accordion items together. To split it across two tabs,
extract the accordion items into two separate render functions or sub-components:

```tsx
// In MediaDisplaySettingsSection.tsx or new files:
export function GalleryStyleAccordion({ settings, updateSetting, tooltipLabel }) {
  // Renders accordion items: viewport, tile-appearance, transitions
  // Plus GalleryPresentationSections (backgrounds)
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

**`GeneralSettingsSection.tsx` — Extract Security & Login:**

Extract the accordion item with value `gen-security` (contains `sessionIdleTimeoutMinutes`,
`advancedSettingsEnabled`, `showSettingsTooltips`) into a new component:

```tsx
// New file or extracted component
export function SecuritySettingsSection({ settings, updateSetting }) {
  return (
    <Accordion.Item value="gen-security">
      <Accordion.Control>Security &amp; Login</Accordion.Control>
      <Accordion.Panel>
        {/* sessionIdleTimeoutMinutes, advancedSettingsEnabled, showSettingsTooltips */}
      </Accordion.Panel>
    </Accordion.Item>
  );
}
```

Render in the System tab alongside `AdvancedSettingsSection`.

**`AdvancedSettingsSection.tsx` — No changes needed** for structure, but the System tab
will now also include the Security & Login accordion and the Magic Link Page Selector.

### Acceptance criteria

- All existing settings are accessible in the new tab structure with no settings lost.
- Each tab contains 16-60 settings (no tab exceeds 60).
- Background-related settings are co-located within their parent context (Appearance for
  page, Gallery Style for gallery, Campaign Viewer for modal).
- Navigation settings (both basic and advanced) are conceptually grouped.
- Security & Login settings are in the System tab.
- All existing accordion section components are preserved with their internal structure
  unchanged.
- `advancedSettingsEnabled` gate still controls visibility of the System & Admin tab.
- No regressions in existing SettingsPanel tests (`SettingsPanel.test.tsx`).
- E2E test `mantine8-runtime-qa.spec.ts` passes (may need tab name updates).

### Validation

- Manual QA: open Settings Panel, verify all 6 previously visible tabs + System tab are
  accessible and contain the expected accordion sections.
- Manual QA: toggle `advancedSettingsEnabled` on/off — verify System tab appears/disappears.
- Manual QA: verify no accordion item is rendered in two places (especially Security & Login).
- Vitest: `SettingsPanel.test.tsx` — update tab value references if any exist.
- E2E: `mantine8-runtime-qa.spec.ts` — update tab role names if they reference
  "Gallery & Media" or "Page & Theme".

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/SettingsPanel.tsx` | Rename/restructure tabs; re-parent accordion sections; update default active tab |
| `src/components/Settings/MediaDisplaySettingsSection.tsx` | Split into GalleryStyle + GalleryNavigation sub-components (or extract accordion items) |
| `src/components/Settings/GeneralSettingsSection.tsx` | Extract Security & Login accordion into separate component |
| `src/components/Settings/AdvancedSettingsSection.tsx` | No structural change; receives Security & Login in parent tab |
| `src/components/Admin/SettingsPanel.test.tsx` | Update tab value references |
| `e2e/mantine8-runtime-qa.spec.ts` | Update tab role names ("Gallery & Media" -> "Gallery Layout", etc.) |

### Effort Estimate

~4-6 hours. The work is primarily re-organizing imports, tab values, and accordion item
placement in `SettingsPanel.tsx`. The `MediaDisplaySettingsSection` split requires
careful extraction of accordion items but no logic changes. The Security & Login extraction
is a simple cut-and-paste. Test updates are mechanical find-and-replace.

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
- P29-E (Admin Panel mobile responsiveness) in progress.
- P29-F (Settings re-grouping) planned — analysis complete, implementation pending.
- Follow-on to consider: audit whether `rescan_all_media_types` and other
  functions that call `update_post_meta('media_items', ...)` are similarly
  exposed to the `sanitize_media_items` drop-on-no-id behaviour — those paths
  could wipe IDs if called on data that hasn't been backfilled yet.
