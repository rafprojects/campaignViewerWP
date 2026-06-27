# Phase 58-B Post-Ship Issues

**Created:** 2026-06-26
**Status:** Resolved (all 8 issues fixed 2026-06-26)
**Relates to:** [PHASE58_REPORT.md](PHASE58_REPORT.md) › Track P58-B

Issues discovered during manual QA of the P58-B responsive / per-breakpoint slot overrides feature. Grouped by surface area. Each entry includes the observed symptom, the root cause, and the resolution.

> **Resolution summary (2026-06-26).** All eight issues fixed in the P58-B fix-up.
> The headline finding: the "overrides never render" complaint (B-4) was a
> **server persistence** bug — the PHP allowlist in `class-wpsg-layout-templates.php`
> had drifted out of sync with the TypeScript type and silently stripped
> `breakpointOverrides` on every save. A full TS↔PHP audit found the same drift
> had also been silently dropping slot `opacity` (P58-A), `entranceAnimation`
> (P58-E), `groups` (P30-G), and the entire P50-J overlay transform/shape/border/
> effects field set. All are now persisted, with a round-trip regression test
> guarding against future drift. See each issue below for specifics.

---

## Group 1 — LayoutBuilder: Breakpoint Editing

### Issue B-1: Rotation is global, not per-breakpoint

**Symptom.** Changing a slot's rotation in the inspector applies to *all* breakpoints, not just the one currently being edited. Expected: switching to Tablet mode and adjusting rotation should produce a tablet-only override.

**Root cause.** `rotation` is included in `SLOT_BREAKPOINT_OVERRIDE_KEYS` (so the type system supports per-breakpoint rotation), but the *inspector action path* goes through `updateSlot`, which was not made breakpoint-aware in P58-B. Only `moveSlot`, `resizeSlot`, and `nudgeSlots` were updated to write to `template.breakpointOverrides[bp][slotId]` instead of the base slot; all other inspector updates still go directly to the base slot.

**Fix direction.** Make `updateSlot` (and optionally `updateSlots`) breakpoint-aware: when `activeBreakpoint !== 'desktop'` and the update keys are a subset of `SLOT_BREAKPOINT_OVERRIDE_KEYS`, merge them into `template.breakpointOverrides[bp][slotId]` rather than the base slot. Keys outside `SLOT_BREAKPOINT_OVERRIDE_KEYS` (e.g. `shape`, `objectFit`, `borderRadius`) should always update the base slot regardless of breakpoint.

---

### Issue B-2: Layers panel visibility is global, not per-breakpoint

**Symptom.** Toggling visibility off for a slot in the Layers panel hides it in *all* breakpoints simultaneously. Expected: hiding a slot while in Tablet mode should set `visible: false` only for the tablet breakpoint.

**Root cause.** Same as B-1. `toggleSlotVisible` (in `useLayoutBuilderOverlays` / the main state hook) writes directly to `slot.visible` on the base slot, bypassing the breakpoint-override path entirely.

**Fix direction.** When `activeBreakpoint !== 'desktop'`, `toggleSlotVisible` should write `{ visible: !effectiveValue }` to `template.breakpointOverrides[bp][slotId]` instead of mutating the base slot. The "effective value" to toggle off of should be resolved via `resolveSlotForBreakpoint` so it reflects the slot's current apparent state in the active breakpoint.

---

### Issue B-3: Campaign view switches adapter at breakpoint boundary instead of staying in Layout Builder

**Symptom.** When viewing a campaign in the frontend, the Layout Builder gallery renders responsively (shrinking with the container) until the tablet breakpoint is hit (~768 px), at which point the page switches to whichever adapter was configured for the tablet breakpoint in the gallery config — e.g. masonry or cards — instead of continuing to use Layout Builder at a narrower canvas.

**Root cause.** This is an existing, pre-P58-B behaviour of the gallery config's breakpoint adapter-switching system (unrelated to the new slot overrides). The `ResolvedGallerySectionRuntime.breakpoint` changes at the threshold, and the gallery section swaps the entire adapter component. P58-B assumed Layout Builder would remain the adapter across all breakpoints, but the gallery config lets each breakpoint independently choose a different adapter.

**Fix direction / design question.** Two approaches to evaluate:

1. **Do nothing to the adapter-switch system; document the gap.** Users who want Layout Builder across all breakpoints need to explicitly set Layout Builder for each breakpoint in the gallery config. See Issue B-4 for the current friction around that.
2. **"Sticky Layout Builder" mode.** Provide an option (on the Layout Builder adapter config) to disable breakpoint adapter-switching and always use Layout Builder, falling back to per-breakpoint slot overrides for responsive differences. Higher complexity, but avoids users needing to configure each breakpoint separately.

Decision needed from product before implementing.

---

### Issue B-4: Per-breakpoint slot overrides are not applied in the rendered gallery

**Symptom.** When a user configures the tablet (and mobile) breakpoint to use Layout Builder and then views the campaign at a tablet-width container, the layout does not reflect the slot overrides designed in the builder. The desktop slot positions are retained and the canvas simply shrinks — the breakpoint overrides have no visible effect. The entire point of P58-B was for these designed overrides to render at the appropriate device width; if they are silent in the gallery, the feature is non-functional end-to-end.

**Root cause (suspected, not verified).** The most likely cause is that `breakpointOverrides` is not being persisted to or returned from the server. The P58-B implementation added the field to the TypeScript type and client-side state, but if the WordPress REST API handler for saving/loading `LayoutTemplate` objects does not include `breakpointOverrides` in the allowed fields, the field will be stripped on save and never sent back to the gallery on fetch. The builder *appears* to work because it operates on client-side state; the gallery fails because it renders from the server-fetched template, which is missing the field.

Secondary possibilities: the `containerWidth` breakpoint detection inside `LayoutBuilderGallery.tsx` is not receiving the correct container width when the gallery is rendered at a sub-tablet width, so `containerWidthToBreakpoint` always returns `'desktop'`.

**Fix direction.**
1. Verify the PHP REST API handler (`LayoutTemplate` save/load endpoint) explicitly allowlists and serialises the `breakpointOverrides` field. This is the primary suspect.
2. If the field is persisted correctly, add a diagnostic: log `containerWidth` and the resolved `activeBreakpoint` in `LayoutBuilderGallery.tsx` and confirm they change as the container narrows.
3. Once the field round-trips correctly, the `slotPositionCss` memo and `resolveSlotForBreakpoint` path implemented in P58-B should work without further changes.

---

### Issue B-5: Layout Builder is disabled as an adapter option for mobile breakpoints

**Symptom.** When configuring the mobile breakpoint in the gallery config, Layout Builder is not available as an adapter choice. This was not anticipated in the P58-B planning — the responsive work assumes Layout Builder can be active at all three breakpoints, but the mobile restriction makes this impossible to configure fully.

**Root cause.** There is a code-level restriction (exact location TBD) that excludes Layout Builder from the adapter list when the scope is mobile. This predates P58-B and was apparently added as a conservative constraint when the Layout Builder was first shipped.

**Fix direction.** Remove the mobile restriction. Layout Builder is now responsive-capable (P58-B slot overrides, container-width breakpoint detection in the gallery renderer). The original reason for restricting mobile is unknown but likely stale; confirm and remove.

---

## Group 2 — LayoutBuilder: Gallery Config UX

### Issue B-6: No layout template picker in gallery config when Layout Builder is selected as adapter

**Symptom.** In the gallery config panel (inside the campaign or breakpoint settings), selecting "Layout Builder" as the gallery adapter shows no control to choose *which* layout template to use. The user must navigate to Admin Panel › Campaigns › Edit (a separate screen) to assign a template. This is a significant discoverability gap.

**Root cause.** UX oversight: the gallery config adapter-settings panel for Layout Builder was built before or without an inline template picker. The template assignment lives in the campaign edit form, not in the adapter config.

**Fix direction.** Add a layout template selector to the Layout Builder adapter settings panel in the gallery config editor. It should display available templates (from the existing template list API) and let the user assign one inline, the same way they would configure columns or gap for a Cards adapter. The selection should update `CampaignLayoutBinding.templateId`.

---

## Group 3 — LayoutBuilder: Gallery Render

### Issue B-7: Slot rotation resets to 0° on hover

**Symptom.** Slots that have a non-zero `rotation` value immediately snap back to 0° (un-rotated) when the mouse hovers over them. Rotation is not maintained during hover effects (the "Pop" hover bounce is enabled).

**Root cause.** The hover CSS or the hover JavaScript animation (`buildTileStyles` / `buildBoxShadowStyles` / tilt effect) likely generates a `transform` property that overwrites the slot's rotation `transform` injected by `slotPositionCss`. CSS `transform` is a single property — if both the rotation rule and the hover rule write `transform`, the later rule wins and the rotation is lost.

**Fix direction.** The slot position CSS rule in `LayoutBuilderGallery.tsx` emits `transform: rotate(${rotation}deg)`. The hover effect must *compose* with this rotation rather than replace it — either by appending `rotate(Ndeg)` to the hover's transform chain, or by restructuring the slot wrapper to separate rotation (outer element) from hover scale/translate (inner element). The fix should apply to both the builder preview and the gallery render.

---

### Issue B-8: Slot-count mismatch warning shown to public viewers

**Symptom.** When a campaign has fewer Layout Builder slots than media items, a banner appears at the top of the gallery reading *"1 media item(s) have no slot — they won't be displayed."* This is appropriate for admins and editors, but public / non-authenticated viewers should never see it.

**Root cause.** The visibility check on this banner is either absent or gated incorrectly. The `isAdmin` prop is available on `LayoutBuilderGallery` — if the banner is gated on `isAdmin` it may be evaluating as `true` for public embeds depending on how the prop is supplied, or the gate is missing entirely.

**Fix direction.** Gate the slot-count mismatch banner strictly on `isAdmin === true`. Confirm the prop is correctly passed as `false` (or `undefined`) in public frontend render contexts (non-authenticated page loads, shortcode embeds, block editor previews without admin context).

---

## Resolution Status (2026-06-26)

| # | Issue | Status | Resolution |
|---|-------|--------|------------|
| B-4 | Breakpoint overrides not persisted | ✅ Fixed | Added `breakpointOverrides` (+ `groups`, slot `opacity`/`entranceAnimation`, P50-J overlay fields) to the PHP allowlist; bumped `SCHEMA_VERSION` to 2; added a persistence round-trip regression test. |
| B-8 | Public banner visible to readers | ✅ Fixed | Gated the slot-mismatch banner on `isAdmin` (matching its sibling summary); added a public-viewer test. |
| B-7 | Rotation lost on hover | ✅ Fixed | Bounce keyframes now compose a `--wpsg-slot-rot` custom property (default `0deg`); the gallery sets it per rotated slot so the angle survives the bounce. |
| B-2 | Visibility global, not per-breakpoint | ✅ Fixed | `toggleSlotVisible` writes a per-breakpoint override when editing tablet/mobile. Hidden slots ghost (selectable) in the builder; the gallery truly hides them. |
| B-1 | Rotation/appearance global, not per-breakpoint | ✅ Fixed | `updateSlot` routes override-eligible keys (rotation, opacity, …) to the breakpoint layer when editing tablet/mobile; non-override keys still edit the base slot. |
| B-5 | Layout Builder disabled for mobile | ✅ Fixed | Removed `supportsMobile: false` from the LB registration and the stale "(desktop/tablet only)" label; LB now participates at mobile. |
| B-6 | No template picker where the adapter is chosen | ✅ Fixed | Contextual campaign-level picker: the existing "Layout Template" Select is emphasized with a warning when LB is the chosen adapter but no template is assigned. (Generic config editor left untouched — it is campaign-agnostic by design.) |
| B-3 | Adapter switches at breakpoint boundary | ✅ Resolved | Behaves as designed once B-4/B-5 land — see the contract below. |

## B-3 — Resolved adapter contract

Adapter resolution per breakpoint (from `src/utils/resolveAdapterId.ts`):

```
adapter = campaign override for this breakpoint
        ?? this breakpoint's explicit adapter
        ?? representative fallback (first configured among desktop → tablet → mobile)
        ?? 'classic'
```

**Contract:** A Layout Builder breakpoint layout renders at any breakpoint whose
adapter resolves to `layout-builder` — either set explicitly, or **inherited** when
the breakpoint has no explicit adapter (it inherits the first-configured one, e.g.
desktop). A breakpoint you deliberately point at another adapter renders that adapter
instead (deliberate per-breakpoint choices are respected, not overridden). With B-5
fixed, mobile now participates in this inheritance instead of dropping to `'classic'`.

**Decision:** "unblock + inherit" (not "sticky Layout Builder") — user direction,
2026-06-26. There is **one** template per campaign; responsive differences come from
its per-breakpoint slot overrides, not from per-breakpoint template switching.

**Manual QA still recommended** (via the `see-wp` / `verify` flow): confirm that a
campaign with desktop = Layout Builder and an unconfigured tablet/mobile inherits LB
and renders the overrides at those widths, and that a breakpoint explicitly set to a
different adapter renders that adapter.
