# Phase 15 Plan — Critique Review & Disposition

**Date:** February 22, 2026  
**Purpose:** Assess each criticism and suggestion from the external review of PHASE15_REPORT.md. Items are categorized as **ACCEPT**, **ACCEPT WITH MODIFICATION**, **DEFER**, or **REJECT** with rationale.

---

## Critique 1: Breakpoint Detection — Mantine Alignment

**Claim:** `useBreakpoint()` with hardcoded thresholds duplicates Mantine's responsive utilities (`useMediaQuery`, theme breakpoints) and risks inconsistency if Mantine evolves its breakpoints. Also notes missing orientation change / high-DPI handling.

### Assessment: ACCEPT WITH MODIFICATION

The critique is **partially valid**. CampaignViewer already uses `useMediaQuery('(max-width: 48em)')` from `@mantine/hooks`, and AuthBar uses `useMediaQuery('(max-width: 36em)')`. Our plan proposes a *third* system (`useBreakpoint()` with `ResizeObserver` at 768px/1024px pixel thresholds). That's three uncoordinated responsive approaches.

However, the critique misses a key reason we specified `ResizeObserver` on the container rather than `window.matchMedia` (which is what `useMediaQuery` wraps): **this app embeds inside WordPress shortcodes and Shadow DOM**. The gallery container width may be 600px inside a WordPress sidebar even on a 1920px desktop screen. `useMediaQuery` checks the viewport, not the container — it would incorrectly report "desktop" for a narrow embed.

**Recommendation:** Keep `ResizeObserver` on the container (essential for embeds), but:
1. Source the px thresholds from the Mantine theme's breakpoint tokens (`sm`=576, `md`=768, `lg`=1024) via `useMantineTheme()` rather than hardcoding, so they stay in sync.
2. No action needed for orientation changes — `ResizeObserver` fires automatically when the container resizes on orientation change. High-DPI is irrelevant since we measure CSS px, not device pixels.
3. Deprecate the direct `useMediaQuery` calls in `CampaignViewer.tsx` and `AuthBar.tsx` in favor of the new `useBreakpoint()` in a cleanup pass (separate from P15 scope, noted for future work).

**Plan update needed:** Modify P15-A.2 to note Mantine theme breakpoint sourcing. Add a note that `useMediaQuery` usages elsewhere should be aligned in a future cleanup.

---

## Critique 2: Data Persistence & Scalability

**Claim:** WP option storage risks performance with many templates. Lacks multi-user access controls. Public REST endpoint exposes all template data.

### Assessment: MIXED — partially accept, partially reject

**Template count scalability:** ACCEPT the concern but the threshold is reasonable. WordPress `get_option()` with autoload=yes is fast up to ~1MB of serialized data. A template with 20 slots is ~2KB of JSON. Even 200 templates would be ~400KB — well within safe range. The plan's risk register already flags this and names the migration path (dedicated table). Adding a concrete threshold (200 templates) and a soft warning in the PHP class is sensible.

**Multi-user access controls:** REJECT. Our admin REST endpoints already gate behind `require_admin()` which checks `current_user_can('manage_wpsg')` — a custom capability. This is the standard WordPress RBAC pattern. Multiple admins can all manage templates; non-admins cannot. The critique implies per-template ownership, which would be over-engineering for a plugin where all admins share the same gallery infrastructure.

**Public endpoint security:** ACCEPT WITH MODIFICATION. The critic is right that the public GET endpoint for templates (needed so the frontend can render layouts) shouldn't expose ALL templates — only the specific one referenced by a campaign. The plan already specifies `/layout-templates/{id}` (single template by ID) as the public route, not a list endpoint. But we should add a note: the public endpoint should **only return templates that are referenced by at least one published campaign** (or accept the read-only ID lookup as sufficient, since template IDs are UUIDs and not guessable). The ID-based lookup is the practical approach — if you know the UUID, you can read the template. This matches how WP serves attachment URLs.

**Transient cache suggestion:** REJECT. `get_option()` with `autoload=yes` is already loaded into memory on every WP request — adding a transient layer on top would be pure overhead (transients themselves fall back to options when no object cache is present). If the site has Redis/Memcached, options are already cached.

**Plan update needed:** Add 200-template soft limit with admin warning. Add note that public endpoint is ID-based (no list), UUIDs are unguessable.

---

## Critique 3: Builder UI — Undo/Redo State & Accessibility

**Claim:** Undo/redo with deep copies of templates is heavy. Missing accessibility (keyboard nav, ARIA, screen readers). localStorage auto-save lacks multi-tab conflict resolution.

### Assessment: MULTIPLE SUB-ITEMS

### 3a: Immer.js for undo/redo — LEANING ACCEPT, WANT INPUT

The critique suggests Immer.js (~3KB gzipped) to simplify immutable state updates for the undo stack. This is a legitimate concern — `LayoutTemplate` contains nested arrays of slots/overlays, and manual deep cloning via `structuredClone()` or spread operators is error-prone.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **A: Immer.js** | Proven, tiny (3KB), `produce()` makes nested updates trivial, works perfectly with `useReducer`. Undo = just store previous states; Immer handles immutability automatically. | New dependency. Minor learning curve for contributors unfamiliar with Immer's draft concept. |
| **B: `structuredClone()` + vanilla** | Zero dependencies. `structuredClone()` is native in all modern browsers and Node 17+. Undo stack stores snapshots via `structuredClone(template)` before each mutation. | More verbose update code. Manual spread for nested updates is fragile (missing a level = mutation bug). Every update function must remember to clone. |
| **C: `useReducer` + structuredClone snapshots** | Middle ground — `useReducer` structures updates, `structuredClone` handles snapshots. | Still verbose for nested updates but organized. |

**My recommendation:** Option A (Immer). The builder state is the most complex state management in the entire app — nested slots, overlays, multi-select, undo/redo across drag/resize/property-change operations. Immer's 3KB is negligible vs. the bug prevention it provides. The `produce()` API is essentially "write mutable code, get immutable output" — ideal for the builder's many mutation types.

However, `structuredClone()` snapshots (Option C) would also work and avoids the dependency. This is a preference question.

**Decision requested from user.** ← Awaiting input

### 3b: Accessibility — ACCEPT

The critique is correct and this is a real gap in the plan. WordPress plugin guidelines recommend accessible admin UIs. Key additions:

- Arrow keys to nudge selected slot(s) by 1% (Shift+arrow = 0.1% for fine positioning)
- `role="img"` with `aria-label` on slot elements
- Focus management: Tab key cycles through slots, Enter selects
- Screen reader announcements for drag start/stop ("Slot 3 moved to 25%, 40%")
- ARIA live region for guide snapping feedback

This is modest effort — mostly event handlers and ARIA attributes on existing elements. Should be wired into P15-C.4 and P15-C.5.

**Plan update needed:** Add A11y subsection to P15-C.

### 3c: Multi-tab conflict resolution for auto-save — REJECT

Over-engineering. The builder is a full-screen modal — if you open a second tab and open the builder there too, you're intentionally working on two things. localStorage auto-save is a crash recovery mechanism, not a collaboration tool. The save-to-REST-endpoint is the authoritative action. We can add a simple check: on builder open, if a localStorage draft exists with a different template ID than the one being opened, discard it. If same template ID, offer to restore. This is already implied by the plan's auto-save design.

---

## Critique 4: Rendering & Integration

**Claim:** Viewport-mode thumbnail strip scrolling needs smooth animation. Percentage positioning may distort on varying aspect ratios. Empty slot placeholders might confuse users.

### Assessment: MOSTLY ACCEPT

**Smooth scroll to thumbnail:** ACCEPT. `scrollIntoView({ behavior: 'smooth' })` is the right approach. This is a one-liner in the slot click handler for viewport mode. Should be noted in P15-E.3.

**CSS `aspect-ratio` property:** ACCEPT. The suggestion to use CSS `aspect-ratio` on the container is correct and cleaner than JavaScript-computed height. Modern browser support is excellent (95%+ globally). We should specify this in P15-E.1.

**Aspect ratio distortion concern:** PARTIALLY REJECT. The critic says "real viewports may have varying aspect ratios within breakpoints." This is exactly why we store canvas `canvasAspectRatio` separately from container width. The layout container is rendered at a fixed aspect ratio (via CSS `aspect-ratio`) regardless of the container's shape — the container may be wider or narrower, but the layout maintains its designed proportions (letterboxed or with side margins if needed). No distortion occurs; the layout simply may not fill the full width.

**Empty slot placeholders:** ACCEPT. The plan already describes placeholders for empty slots in P15-E.4, but the suggestion to add a builder-time warning is good. Add: when saving a template or assigning to a campaign, if media count doesn't match slot count, show an info notification ("This layout has 6 slots but the campaign has 4 images — 2 slots will be empty").

**Plan update needed:** Add `scrollIntoView` note to P15-E.3, CSS `aspect-ratio` to P15-E.1, slot count mismatch warning to P15-E.4.

---

## Critique 5: Stretch Goal Scope

**Claim:** Visual clip-path editor (P15-K.3) is over-scoped for a stretch. Premade templates should be dynamic rather than static JSON.

### Assessment: PARTIALLY ACCEPT

**Clip-path editor:** ACCEPT the deferral. The plan already marks P15-K as "stretch 5 (lowest priority, attempt last)." The visual polygon editor (P15-K.3) specifically is realistically a future-phase feature, not a stretch goal. We should note it as "deferred to future phase" within P15-K rather than a stretch deliverable.

**Dynamic vs. static presets:** REJECT. The critique suggests storing premade templates in a WP option for admin customization. But premade templates are *already* just templates — once imported into the library (P15-F), they become regular templates that can be edited, duplicated, and deleted. Storing the initial set as static JSON bundled with the app (loaded on first install or via "Reset to defaults") is the proven pattern (similar to how WordPress ships default themes). Making the defaults themselves mutable adds complexity with no benefit — the user modifies the imported copy, not the original preset.

**Plan update needed:** Move P15-K.3 (visual polygon editor) from stretch to "deferred to future phase."

---

## Critique 6: Dependencies & Packages

**Claim:** `react-rnd` hasn't had a major update in ~2 years. Should use native `canvas.toDataURL()` instead of `html-to-image` for previews.

### Assessment: MIXED

**react-rnd staleness:** ACKNOWLEDGED but low risk. The library's API is stable because its scope is narrow — drag + resize with bounds. It works with React 18 today. The plan already notes vendoring/forking as mitigation. No action needed.

**html-to-image vs. native canvas:** LEANING ACCEPT, WANT INPUT. The critique suggests avoiding `html-to-image` in favor of `document.createElement('canvas')` + `drawImage()`.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **A: `html-to-image`** | Captures full DOM including CSS clip-paths, overlays, borders, backgrounds — WYSIWYG preview. One function call. | 8KB dependency. |
| **B: Native canvas drawImage** | Zero dependency. | Cannot capture CSS clip-path shapes, borders, overlays, drop-shadows. Would need to manually re-render every visual effect on canvas — essentially reimplementing the layout renderer in canvas (the exact thing we chose NOT to do by rejecting Konva). Preview would look different from the actual layout. |
| **C: Offscreen DOM render + `html-to-image`** | Same as A but renders in a hidden container at thumbnail size. | Same as A. |
| **D: Skip preview thumbnails for v1** | Templates show name + slot count + aspect ratio as text. No visual preview. | Less polished but dramatically simpler. Preview generation is a nice-to-have, not a core requirement. |

**My recommendation:** Option D for v1. Template previews are a polish feature in P15-F.3. Ship without them initially, add later if needed. If we do add them, `html-to-image` is the correct choice because the whole point is to capture what the layout *actually looks like* — native canvas can't do that for DOM-based layouts with CSS effects.

**Decision requested from user.** ← Awaiting input

---

## Critique 7: Additional Suggestions

### 7a: Debounced resize handler — REJECT

The critique suggests `lodash.debounce` or `setTimeout` for resize events. `ResizeObserver` already fires at an appropriate rate (once per animation frame). Adding debounce on top would introduce visible lag in layout updates. The adapters (hexagonal, diamond) already use raw `ResizeObserver` without debouncing and performance is fine.

### 7b: Preview mode toggle in builder — ACCEPT

Good suggestion. A toggle between "Edit mode" (shows handles, guides, slot numbers) and "Preview mode" (hides all chrome, shows finalized rendering with actual hover effects) is valuable for contextual editing. Low effort — it's mostly hiding/showing builder chrome. Add to P15-C.2 as a header bar toggle.

**Plan update needed:** Add preview mode toggle to P15-C.2.

### 7c: Builder overlap/bounds warnings — ACCEPT

The suggestion to warn when slot percentages exceed 100% or leave canvas bounds is already handled by `react-rnd`'s `bounds="parent"` constraint (prevents dragging outside). But a validation warning on save (e.g., "Slot 3 extends beyond canvas") is a good safety net for edge cases. Add to P15-B.2 validation.

### 7d: Telemetry/metrics — REJECT for Phase 15

Builder usage metrics are valid but scope creep. Phase 14 already added the health/monitoring infrastructure. Tracking builder usage would be a trivial extension of that system but doesn't belong in the builder phase itself.

### 7e: Quick-start guide in admin UI — DEFER

Good idea but not Phase 15 scope. This is a documentation/onboarding effort that should happen after the builder is stable and we know which concepts actually confuse users.

### 7f: Multi-device E2E testing — ACCEPT

Playwright device presets for E2E tests are trivially easy to add (`playwright.config.ts` `projects` array). The plan already specifies E2E scenarios — adding `{ name: 'Mobile', use: devices['iPhone 13'] }` and tablet presets costs ~5 lines of config. Add to testing strategy.

---

## Summary

| # | Critique | Disposition | Action Required |
|---|----------|-------------|-----------------|
| 1 | Breakpoint detection — Mantine alignment | ACCEPT WITH MOD | Source thresholds from Mantine theme; keep ResizeObserver |
| 2a | WP option scalability | ACCEPT | Add 200-template soft limit |
| 2b | Multi-user access controls | REJECT | Already gated by `manage_wpsg` capability |
| 2c | Public endpoint security | ACCEPT (clarify) | Note ID-based lookup only, UUIDs unguessable |
| 2d | Transient cache | REJECT | `autoload=yes` already optimal |
| 3a | Immer.js for undo/redo | **WANT INPUT** | Immer (3KB) vs. structuredClone + vanilla |
| 3b | Accessibility (a11y) | ACCEPT | Add keyboard nav, ARIA, screen reader to P15-C |
| 3c | Multi-tab localStorage conflict | REJECT | Over-engineering for crash recovery |
| 4a | Smooth thumbnail scroll | ACCEPT | Add scrollIntoView to P15-E.3 |
| 4b | CSS aspect-ratio | ACCEPT | Add to P15-E.1 |
| 4c | Aspect ratio distortion | REJECT | Already handled by fixed aspect-ratio container |
| 4d | Empty slot warnings | ACCEPT | Add mismatch notification |
| 5a | Clip-path editor over-scoped | ACCEPT | Move P15-K.3 to future phase |
| 5b | Dynamic presets | REJECT | Static JSON → import is the established pattern |
| 6a | react-rnd staleness | ACKNOWLEDGED | No action (already mitigated in risk register) |
| 6b | html-to-image vs. canvas | **WANT INPUT** | Recommend skip previews for v1 (Option D) |
| 7a | Debounced resize | REJECT | ResizeObserver rate is already appropriate |
| 7b | Preview mode toggle | ACCEPT | Add to P15-C.2 |
| 7c | Bounds/overlap warnings | ACCEPT | Add validation to P15-B.2 |
| 7d | Telemetry | REJECT | Scope creep for Phase 15 |
| 7e | Quick-start guide | DEFER | Post-stabilization |
| 7f | Multi-device E2E | ACCEPT | Add device presets to testing strategy |

### Items Awaiting Your Input

1. **Immer.js (3a):** Add as dependency for builder state management, or use vanilla `structuredClone()` + `useReducer`?
2. **Template previews (6b):** Ship v1 without visual preview thumbnails (just name/metadata), or implement with `html-to-image`?

---

*Document created: February 22, 2026*
