# Layout Builder — QA Plan

> **Version:** 1.0  
> **Last Updated:** 2025-02-23  
> **Scope:** Phase 15 Layout Builder (Sprints 1–6)

---

## Overview

This document defines a repeatable QA routine for the Layout Builder feature. Tests are categorized into **Critical (Always Test)** and **Extended (Optional)** tiers, covering automated unit/integration tests, manual browser validation, and backend PHP verification.

---

## 1. Critical Tests (Always Run)

These tests **must pass** before every release. Failures here block deployment.

### 1.1 Automated — Vitest (Frontend)

| Area | Test File | What It Covers |
|------|-----------|----------------|
| State hook core | `useLayoutBuilderState.test.ts` | Slot CRUD, template mutations, selection, undo/redo, dirty tracking, preview toggle |
| Clip-path utility | `utils/clipPath.test.ts` | All 11 shapes mapped correctly, `usesClipPath` predicate |
| Preset templates | `data/layoutPresets.test.ts` | 12 presets valid, slot counts, aspect ratios, grid non-overlap |
| Gallery rendering | `LayoutBuilderGallery.test.tsx` | Slots render at correct positions, clip-path applied, overlay rendering, media assignment |
| Smart guides | `utils/smartGuides.test.ts` | Snap detection, alignment guides, threshold logic |
| Slot assignment | `utils/layoutSlotAssignment.test.ts` | Auto-assignment, round-robin, empty-slot handling |

**Run command:**
```bash
npx vitest run
```

**Pass criteria:** 0 failures, TSC clean (`npx tsc --noEmit`).

### 1.2 Automated — PHPUnit (Backend)

| Area | Test File | What It Covers |
|------|-----------|----------------|
| Template CRUD | `tests/WPSG_Layout_Templates_Test.php` | Create, read, update, delete, duplicate, sanitize, migrate, shape whitelist |

**Run command (requires WP test environment):**
```bash
cd wp-plugin/wp-super-gallery
./vendor/bin/phpunit --filter WPSG_Layout_Templates_Test
```

**Pass criteria:** 0 failures, 0 errors.

### 1.3 Manual — Core Workflow (5–10 min)

Run through this checklist in a browser with the WP admin panel open:

#### Template Lifecycle

- [ ] **Create:** Click "New Layout" → template appears with default name, empty canvas
- [ ] **Rename:** Double-click template name in the sidebar → type → press Enter → name persists
- [ ] **Save:** Make changes → "Save" button enabled (dirty indicator visible) → click Save → confirm via toast + dirty flag clears
- [ ] **Delete:** Delete a template → confirmation dialog → removed from list → cannot re-open
- [ ] **Duplicate:** Duplicate a template → new copy appears with "(Copy)" suffix, unique ID, unique slot IDs

#### Slot CRUD

- [ ] **Add slot:** Click "Add Slot" → new slot appears with staggered offset, auto-selected
- [ ] **Select slot:** Click a slot → highlighted with blue outline, properties panel updates
- [ ] **Multi-select:** Shift+click multiple slots → all highlighted, properties panel shows shared values
- [ ] **Move slot:** Drag to new position → coordinates update in properties panel → stays within canvas bounds
- [ ] **Resize slot:** Drag resize handles → width/height update → minimum 5% enforced
- [ ] **Delete slot:** Select slot(s) → press Delete or click Remove → slot(s) removed, selection cleared
- [ ] **Duplicate slot:** Select slot(s) → click Duplicate → copies appear offset by ~3%, auto-selected, clamped to canvas

#### Undo / Redo

- [ ] **Undo:** Make 3 changes → Ctrl+Z three times → all reverted, dirty flag still set
- [ ] **Redo:** After undo → Ctrl+Shift+Z → change re-applied
- [ ] **Branch:** After undo → make new change → redo stack cleared (Ctrl+Shift+Z does nothing)

#### Preview Mode

- [ ] **Toggle preview:** Click preview icon → builder chrome (toolbar, handles, guides) hidden → slots render at positioned sizes → toggle off restores builder UI

---

## 2. Feature-Specific Tests (Always Run)

### 2.1 Z-Index / Overlap Control (P15-G)

- [ ] **Bring to front:** Select back slot → Shift+] → slot renders on top
- [ ] **Send to back:** Select front slot → Shift+[ → slot renders behind others
- [ ] **Bring forward / backward:** ] and [ keys adjust by one z-level
- [ ] **Z-badge:** Sidebar slot list shows numeric z-index badge per slot, sorted by z-order
- [ ] **Save normalization:** After reordering, save → z-indices normalized to sequential 1..N

### 2.2 Overlay Transparencies (P15-H)

- [ ] **Add overlay:** Overlays tab → upload/URL → overlay appears on canvas with purple outline
- [ ] **Move/resize overlay:** Drag overlay → coordinates update; resize handles work
- [ ] **Opacity slider:** Adjust opacity → overlay transparency changes live (verify 0 = invisible, 1 = opaque)
- [ ] **Click-through toggle:** Enable → overlay has `pointer-events: none` on gallery render, slots beneath remain clickable
- [ ] **Remove overlay:** Click remove → overlay disappears from canvas and sidebar
- [ ] **Gallery render:** Overlays render above slots with correct opacity and pointer-events in the public-facing gallery

### 2.3 Mixed Shapes (P15-I / P15-K)

- [ ] **Shape dropdown:** Properties panel → Shape dropdown lists all 11 shapes with unicode preview icons
- [ ] **Apply each shape:** Select slot → change shape to each of the 11 values → clip-path or polygon updates live:
  - `rectangle` (no clip-path)
  - `circle` → `circle(50%)`
  - `ellipse` → `ellipse(50% 40%)`
  - `hexagon` → polygon
  - `diamond` → polygon
  - `parallelogram-left` → polygon
  - `parallelogram-right` → polygon
  - `chevron` → polygon
  - `arrow` → polygon
  - `trapezoid` → polygon
  - `custom` → uses `customClipPath` field value
- [ ] **Custom clip-path:** Select "custom" → enter `polygon(50% 0%, 100% 100%, 0% 100%)` → renders as triangle
- [ ] **Mask URL:** Enter SVG mask URL → `mask-image` applied with `-webkit-` prefix
- [ ] **Gallery render:** Shapes render identically in the public gallery adapter

### 2.4 Premade Presets (P15-J)

- [ ] **Open preset gallery:** Go to Layouts tab → click "From Preset" button → modal opens with 12 preset thumbnails
- [ ] **Visual preview:** Each preset shows a mini-canvas preview with correct slot positions/sizes
- [ ] **Apply preset:** Click a preset → new template created from preset with correct slot count, aspect ratio, and slot positions
- [ ] **Preset list:** All 12 presets present:
  - Hero + Thumbnails (5 slots)
  - Magazine Spread (5 slots)
  - Pinterest Board (6 slots)
  - Film Strip (4 slots)
  - Spotlight (4 slots)
  - Grid 2×2 (4 slots)
  - Grid 3×3 (9 slots)
  - Panoramic Banner (3 slots)
  - Diagonal Cascade (4 slots)
  - Photo Stack (4 slots)
  - L-Shape (5 slots)
  - T-Layout (5 slots)

---

## 3. Extended Tests (Optional — Run Before Major Releases)

### 3.1 Edge Cases — State Hook

| Scenario | Expected Behavior |
|----------|------------------|
| Add slot when canvas already has 50+ slots | Slot added with staggered position, no overlap errors |
| Remove slot that doesn't exist | No-op, no crash |
| Duplicate with no selection | No-op |
| Nudge slots beyond canvas boundary (0–100%) | Positions clamped to 0–95% |
| Resize slot below 5% minimum | Width/height clamped to 5% |
| Undo when history is empty | No-op, `canUndo: false` |
| Redo at history tip | No-op, `canRedo: false` |
| Exceed MAX_HISTORY (50) | Oldest entry dropped, no memory leak |
| Set aspect ratio to 0 or negative | Validate or clamp to sensible minimum |
| Template with empty name → save | Validate or reject |

### 3.2 Edge Cases — PHP Backend

| Scenario | Expected Behavior |
|----------|------------------|
| Save template exceeding 512 KB (SIZE_LIMIT) | Rejected with error |
| Shape value not in whitelist → `sanitize_slots()` | Reset to `rectangle` |
| Overlay opacity < 0 or > 1 | Clamped to 0.0–1.0 |
| Tags containing HTML/XSS | Sanitized to plain text |
| Schema version 0 → migration | Migrated to version 1 (overlays array added) |
| Non-array `slots` field | Converted to empty array |
| Duplicate template with nonexistent source ID | Returns WP_Error |
| Invalid aspect ratio (string, 0, negative) | Rejected or clamped |
| Slot positions > 100% or < 0% | Clamped during sanitization |

### 3.3 Browser Compatibility

| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | Latest | Critical |
| Firefox | Latest | Critical |
| Safari | Latest | High |
| Edge | Latest | High |
| Chrome Android | Latest | Medium |
| Safari iOS | Latest | Medium |

**What to verify per browser:**
- Canvas renders correctly (slots at right positions)
- Drag-and-drop works (react-rnd)
- Clip-path polygons render (check `clip-path` CSS support)
- Overlay opacity applies
- Keyboard shortcuts (Z undo, arrow nudge, bracket z-index)
- Responsive behavior at different viewport widths

### 3.4 Performance Benchmarks

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Canvas render with 20 slots | < 100ms paint | Chrome DevTools Performance tab |
| Drag slot (60 fps) | No frame drops during drag | DevTools FPS meter |
| Undo/redo latency | < 16ms | Console timer around action |
| Template save (round-trip) | < 500ms | Network tab |
| Preset gallery modal open | < 200ms | User-perceived |
| Builder initial load | < 1s (after JS cached) | Lighthouse |

### 3.5 Accessibility

- [ ] All builder controls keyboard-navigable (Tab order)
- [ ] Slot selection via keyboard (Enter/Space on focused slot)
- [ ] ARIA labels on drag handles and toolbar buttons
- [ ] Color contrast on builder chrome (dark theme)
- [ ] Screen reader announces slot position after move
- [ ] Focus trap within modal dialogs (LayoutBuilderModal, PresetGalleryModal)

### 3.6 Embed / Shadow DOM

- [ ] Layout Builder gallery renders correctly inside Shadow DOM embed
- [ ] CSS clip-paths not broken by shadow boundary
- [ ] Overlay images load cross-origin when embedded on external site
- [ ] No CSS leakage from host page into builder gallery

---

## 4. Regression Checklist

After any code change to the layout builder, verify these don't regress:

### Must-Check Regressions

1. **Shape whitelist sync:** `LayoutSlotShape` TypeScript type, `getClipPath()` in `src/utils/clipPath.ts`, and `$valid_shapes` in `class-wpsg-layout-templates.php` all list the same shapes. Currently 11: `rectangle`, `circle`, `ellipse`, `hexagon`, `diamond`, `parallelogram-left`, `parallelogram-right`, `chevron`, `arrow`, `trapezoid`, `custom`.

2. **getClipPath single source of truth:** The `getClipPath()` function lives ONLY in `src/utils/clipPath.ts`. Both `LayoutSlotComponent.tsx` and `LayoutBuilderGallery.tsx` import from there. Never duplicate it.

3. **Overlay style location:** Opacity and `pointer-events` are applied to the overlay wrapper `<div>`, NOT the `<img>` element inside. Tests assert on `parentElement.style`.

4. **History stack isolation:** `mutate()` calls `pushHistory()` before applying changes. `setSelectedSlotIds` is separate from the history stack — selection changes don't create undo entries.

5. **Slot ID uniqueness:** `generateSlotId()` uses `crypto.randomUUID()`. Duplicate templates must generate new IDs for all slots (backend and frontend).

6. **Z-index normalization:** `normalizeZIndices()` must be called before save to ensure sequential 1..N values.

---

## 5. Test Inventory

### Current Automated Test Count

| File | Tests | Coverage Area |
|------|-------|--------------|
| `useLayoutBuilderState.test.ts` | ~60 | State hook: CRUD, mutations, selection, undo/redo, dirty, preview, z-index, overlays, shapes |
| `clipPath.test.ts` | ~15 | Shape → CSS mapping for all 11 shapes |
| `layoutPresets.test.ts` | ~18 | 12 presets validity, slot counts, aspect ratios |
| `LayoutBuilderGallery.test.tsx` | ~17 | Gallery adapter rendering, overlays, clip-paths |
| `smartGuides.test.ts` | ~25 | Snap alignment calculations |
| `layoutSlotAssignment.test.ts` | ~20 | Media auto-assignment |
| `WPSG_Layout_Templates_Test.php` | ~35 | PHP CRUD, sanitization, migration, duplication |
| **Total** | **~190** | |

### Coverage Gaps (Future Work)

| Component | Current Coverage | Notes |
|-----------|-----------------|-------|
| `PresetGalleryModal.tsx` | 0% | Modal rendering, preset selection callbacks |
| `SlotPropertiesPanel.tsx` | 0% | Input bindings, shape dropdown, overlay tab |
| `LayoutSlotComponent.tsx` | Partial | Drag/resize callbacks via react-rnd |
| `LayoutCanvas.tsx` | 0% | Canvas container, keyboard shortcuts |
| `LayoutBuilderModal.tsx` | 0% | Modal open/close, dirty guard on close |
| `LayoutTemplateList.tsx` | Partial | CRUD buttons, preset gallery integration |

---

## 6. Quick-Start: Running the Full QA Suite

```bash
# 1. TypeScript type check
npx tsc --noEmit

# 2. All Vitest tests
npx vitest run

# 3. Targeted layout builder tests only
npx vitest run src/hooks/useLayoutBuilderState.test.ts \
  src/utils/clipPath.test.ts \
  src/data/layoutPresets.test.ts \
  src/gallery-adapters/layout-builder/LayoutBuilderGallery.test.tsx \
  src/utils/smartGuides.test.ts \
  src/utils/layoutSlotAssignment.test.ts

# 4. PHP tests (requires WP test environment)
cd wp-plugin/wp-super-gallery
./vendor/bin/phpunit --filter WPSG_Layout_Templates_Test

# 5. E2E smoke (if Playwright configured)
npx playwright test e2e/smoke.spec.ts
```

---

## 7. Pre-Release Routine

| Step | Duration | Tier |
|------|----------|------|
| `npx tsc --noEmit` | 30s | Critical |
| `npx vitest run` | ~60s | Critical |
| Manual core workflow (§1.3) | 10 min | Critical |
| Feature-specific manual tests (§2) | 15 min | Critical |
| PHP tests | 30s | Critical |
| Edge case state hook scenarios (§3.1) | 10 min | Extended |
| PHP edge cases (§3.2) | 5 min | Extended |
| Cross-browser spot check (§3.3) | 20 min | Extended |
| Performance spot check (§3.4) | 10 min | Extended |
| Accessibility audit (§3.5) | 15 min | Extended |
| Shadow DOM embed test (§3.6) | 5 min | Extended |
| **Total (Critical only)** | **~28 min** | |
| **Total (Full suite)** | **~2 hours** | |
