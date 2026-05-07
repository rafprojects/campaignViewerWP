# P25-X Tablet/Mobile Card Row Overlap Audit

**Track context:** Phase 25 follow-on QA investigation with direct overlap into in-progress P25-X card breakpoint work  
**Author:** GPT-5.4  
**Date:** 2026-04-04  
**Status:** Actionable investigation with live-settings evidence and recommended next-step fixes  
**Primary scope:**

1. Desktop card rows currently render acceptably.
2. Tablet and mobile card rows visually lose horizontal separation.
3. On smaller breakpoints, cards appear to overlap, with the left edge of one card encroaching on the right edge of the previous card.

---

## Investigation Process

This document leads with the research process because the reported symptom sounds like a responsive CSS bug, but the actual card system now spans multiple layers: saved WordPress settings, sparse breakpoint overrides, container-width-driven runtime resolution, multi-unit width and gap math, and two distinct row-layout branches in `CardGallery.tsx`. The quickest path to a reliable explanation was to narrow those layers one by one instead of assuming the problem lived in a stylesheet.

### 1. Re-open the earlier regression context

The first pass was a quick re-read of the material already gathered during the previous card-grid bug investigation.

Documents reviewed:

- `docs/PHASE25_REPORT.md`
- `docs/P25X_GPT54_SETTINGS_AND_CARD_GRID_REGRESSION_AUDIT.md`
- `docs/P25X_GPT54_PHASES5_8_DEEP_PLAN.md`

Why this mattered:

- `PHASE25_REPORT.md` establishes that the current card layout is part of the broader P25-X card breakpoint and multi-unit rollout.
- `P25X_GPT54_SETTINGS_AND_CARD_GRID_REGRESSION_AUDIT.md` already isolated one real runtime issue in the fixed-width percent branch and made it clear that card layout problems in this phase are not safely treated as isolated CSS glitches.
- `P25X_GPT54_PHASES5_8_DEEP_PLAN.md` documents the intended model: flat top-level card settings as the canonical base, with `cardConfig.breakpoints` used as sparse breakpoint overrides.

That framing was important because it meant the tablet/mobile overlap could be caused by either:

- bad saved breakpoint-specific values,
- or correct saved values interacting badly with the runtime layout math on narrow containers.

### 2. Trace the responsive card pipeline from Settings UI to render output

The second pass followed the full card layout path, from where breakpoint-specific values are edited to where cards are actually rendered.

Files reviewed:

- `src/components/Settings/CampaignCardSettingsSection.tsx`
- `src/utils/cardConfig.ts`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/CampaignGallery/CampaignCard.tsx`
- `src/components/CampaignGallery/CampaignCard.module.scss`

Questions answered in this pass:

1. Which card settings are actually allowed to vary per breakpoint?
2. Is there any tablet/mobile-specific CSS in the card stylesheet that could independently cause overlap?
3. Which runtime branch is responsible for row layout when card width is fixed versus responsive?
4. Which values are shared across breakpoints versus only overridden on tablet/mobile?

What this established:

- Breakpoint-specific card layout is driven by sparse overrides in `cardConfig.breakpoints`, not by separate mobile/tablet stylesheet logic.
- `CampaignCard.module.scss` contains hover, focus, and cosmetic styling, but no breakpoint-specific width or negative-spacing rules that would independently explain tablet/mobile overlap.
- The actual row layout comes from `CardGallery.tsx`, which still has two distinct branches:
  - responsive column-fill branch when `cardMaxWidth <= 0`
  - fixed-width flex branch when `cardMaxWidth > 0`
- The card box itself is rendered by `CampaignCard.tsx`, where the root element uses `width: '100%'` with an optional `maxWidth` supplied by `CardGallery`.

This immediately weakened the idea that the problem was caused by a stray mobile CSS rule.

### 3. Re-check tests and known implementation assumptions

The third pass focused on the breakpoint config tests and the assumptions they already codify.

Files reviewed:

- `src/utils/cardConfig.test.ts`
- `src/components/CampaignGallery/CardGallery.test.tsx`
- `src/types/index.ts`

What this established:

- `CARD_BREAKPOINT_OVERRIDE_KEYS` includes columns, max columns, width, width unit, horizontal/vertical gap, scale, justification, offsets, and related card layout fields.
- The config tests already prove important behaviors:
  - zero-valued breakpoint overrides are preserved as intentional values,
  - value-only overrides inherit units from the base layer,
  - orphaned unit-only overrides are stripped,
  - tablet overrides cascade to mobile when mobile does not explicitly override the field.

This matters because it weakens one tempting explanation: that tablet/mobile gap units are silently disappearing or becoming invalid due to config-pruning bugs. That is still possible in a broader sense, but it is not the leading explanation after reviewing the current tests.

### 4. Inspect the live WordPress settings payload

The fourth pass checked the real saved option state instead of relying only on source code assumptions.

Command used:

- `wp option get wpsg_settings --format=json`

Relevant live values extracted from the current environment:

```json
{
  "card_grid_columns": 0,
  "card_max_columns": 4,
  "card_max_width": 10,
  "card_max_width_unit": "%",
  "card_gap_h": 2,
  "card_gap_h_unit": "%",
  "card_gap_v": 48,
  "card_gap_v_unit": "px",
  "card_scale": 1.5,
  "card_gallery_offset_x": 0,
  "card_gallery_offset_x_unit": "px",
  "app_max_width": 0,
  "app_max_width_unit": "px",
  "app_padding": 16,
  "app_padding_unit": "px",
  "wp_full_bleed_desktop": true,
  "wp_full_bleed_tablet": true,
  "wp_full_bleed_mobile": true,
  "card_config": {
    "breakpoints": {
      "tablet": {
        "cardGridColumns": 3
      },
      "mobile": {
        "cardGridColumns": 0,
        "cardMaxColumns": 2
      }
    }
  }
}
```

This was the most important step in the investigation because it changed the center of gravity of the diagnosis.

Before checking the live payload, the likely causes were split between:

- corrupted or incomplete tablet/mobile overrides,
- and shared runtime math behaving badly on smaller containers.

After checking the live payload, one thing became clear:

- tablet/mobile are **not** currently overriding card width, width unit, gap, gap unit, scale, or horizontal offset.
- the only stored breakpoint-specific overrides are column-related:
  - tablet forces `cardGridColumns = 3`
  - mobile keeps auto mode (`cardGridColumns = 0`) and caps it with `cardMaxColumns = 2`

That means the overlap is not primarily explained by a separately broken tablet/mobile width or gap configuration. The smaller breakpoints are inheriting the same width, gap, and scale settings as desktop, but applying different column behavior.

### 5. Reconcile the live payload with the runtime math

The final pass mapped those live values back onto the current runtime logic.

Relevant code in `CardGallery.tsx`:

```tsx
const hasFixedCardWidth = s.cardMaxWidth > 0;

const fixedCardWidth = useMemo<{ value: number; unit: CssWidthUnit } | null>(() => {
  if (!hasFixedCardWidth) return null;

  const scale = s.cardScale ?? 1;
  const scaledValue = scale !== 1 ? Math.round(s.cardMaxWidth * scale) : s.cardMaxWidth;

  if (s.cardMaxWidthUnit === '%' && containerWidth > 0) {
    return {
      value: Math.round((containerWidth * scaledValue) / 100),
      unit: 'px',
    };
  }

  return {
    value: scaledValue,
    unit: s.cardMaxWidthUnit,
  };
}, [hasFixedCardWidth, s.cardMaxWidth, s.cardMaxWidthUnit, s.cardScale, containerWidth]);
```

and in `CampaignCard.tsx`:

```tsx
style={{
  width: '100%',
  ...(maxWidth ? { maxWidth: toCss(maxWidth, maxWidthUnit) } : {}),
}}
```

That produces the following behavior in the live configuration:

- `card_max_width = 10`
- `card_max_width_unit = '%'`
- `card_scale = 1.5`

The runtime therefore treats the effective width as:

- `10 * 1.5 = 15`
- then, because the unit is `%`, it resolves width as roughly `15% of the measured card gallery container width`

So the same shared settings that feel reasonable on desktop become much smaller on tablet and mobile simply because the container is smaller.

---

## Issue At Hand

### User-visible symptom

- Desktop card rows look correct.
- Tablet and mobile card rows appear to lose their horizontal gap.
- On smaller breakpoints the cards visually run into one another, and the left edge of one card can appear to intrude into the card to its left.

### Expected behavior

- Horizontal separation between cards should remain visible on tablet and mobile.
- Breakpoint-specific column changes should not produce rows that visually collapse.
- Narrow breakpoints should either preserve usable card widths or fall back to a safer layout mode before the row degrades.

---

## Findings

## Finding 1. This is not currently explained by a mobile-only stylesheet bug

**Confidence:** High  
**Status:** Confirmed  
**Recommended priority:** High

### Evidence

`CampaignCard.module.scss` contains hover/focus styling and small cosmetic media-query adjustments, but it does not contain:

- mobile/tablet-specific width rules,
- negative margins,
- overlap-oriented transforms,
- breakpoint-specific flex or grid overrides for row layout.

The row layout is owned by `CardGallery.tsx`, not by the SCSS module.

### Why this matters

This means the investigation should focus on:

- runtime sizing math,
- the fixed-width flex branch,
- and the breakpoint override inputs,

not on hunting for an isolated mobile CSS typo.

---

## Finding 2. The live tablet/mobile overrides only change columns, not width, gap, scale, or offset

**Confidence:** High  
**Status:** Confirmed via live settings payload  
**Recommended priority:** High

### Evidence

The live `card_config` currently contains:

```json
{
  "breakpoints": {
    "tablet": {
      "cardGridColumns": 3
    },
    "mobile": {
      "cardGridColumns": 0,
      "cardMaxColumns": 2
    }
  }
}
```

No breakpoint-specific overrides were found for:

- `cardMaxWidth`
- `cardMaxWidthUnit`
- `cardGapH`
- `cardGapHUnit`
- `cardScale`
- `cardGalleryOffsetX`

### Why this matters

This strongly weakens the hypothesis that tablet/mobile are broken because they saved some special bad width or gap value.

Instead, the smaller breakpoints are inheriting the same shared width, gap, and scale settings as desktop, while only changing the number of columns the layout is trying to fit.

That shifts the likely root cause from “bad breakpoint data” to “runtime math that is fine on desktop but degrades on narrower containers.”

---

## Finding 3. The live site is using a shared fixed-width percent configuration that gets dramatically smaller on narrow containers

**Confidence:** High  
**Status:** Confirmed  
**Recommended priority:** High

### Evidence

Live shared top-level values:

- `card_max_width = 10`
- `card_max_width_unit = '%'`
- `card_scale = 1.5`
- `card_gap_h = 2`
- `card_gap_h_unit = '%'`
- `app_max_width = 0`
- `wp_full_bleed_desktop = true`
- `wp_full_bleed_tablet = true`
- `wp_full_bleed_mobile = true`

Current runtime behavior in `CardGallery.tsx`:

- because `cardMaxWidth > 0`, all breakpoints stay in the fixed-width flex branch,
- because the width unit is `%`, width is resolved against the measured container width,
- because `cardScale = 1.5`, the effective width becomes `15%` of the measured container width.

### Approximate effect by breakpoint

These are illustrative examples using common narrow container sizes, not exact device screenshots:

- desktop with a `1440px` container: `15%` becomes about `216px`
- tablet with a `768px` container: `15%` becomes about `115px`
- mobile with a `375px` container: `15%` becomes about `56px`

The horizontal gap is also shared and percentage-based:

- `cardGapH = 2%`

That means the visual gap shrinks along with the row width. On a narrow row, `2%` becomes only a few pixels.

### Why this matters

Even before accounting for any browser-specific flex behavior, this configuration makes the smaller breakpoints much more fragile than desktop:

- the cards get dramatically narrower,
- the gap gets dramatically smaller,
- tablet/mobile also change their column behavior,
- so the layout approaches a visually collapsed state.

This is the best-supported explanation for the user report that smaller breakpoints seem to lose horizontal separation.

---

## Finding 4. The current fixed-width branch has no minimum usable card-width floor or protective fallback on narrow breakpoints

**Confidence:** Medium-High  
**Status:** Strongly likely  
**Recommended priority:** High

### Evidence

`CardGallery.tsx` keeps using the fixed-width branch as long as `cardMaxWidth > 0`.

`CampaignCard.tsx` then applies that width directly to the card root via `maxWidth`, but there is no guard that says:

- “this effective width is now too small for the chosen breakpoint,”
- or “fall back to responsive fill mode when the computed width drops below a minimum usable size,”
- or “increase gap protection when using percentage gaps on very narrow rows.”

### Why this matters

Desktop can look fine while smaller breakpoints degrade because the system currently assumes that a width formula that is valid in CSS is also visually acceptable at all container sizes.

In this case that assumption is weak:

- `15%` width is not equally usable on desktop and mobile,
- `2%` gap is not equally visible on desktop and mobile,
- and the layout policy does not adapt when the fixed-width row becomes too compressed.

### Practical implication

This does not necessarily mean the row items are mathematically occupying the same box.
It does mean the system has no safety rail before narrow cards and tiny gaps create a layout that reads as overlap to the user.

---

## Finding 5. The breakpoint overrides make the smaller-breakpoint row policy stricter, not looser

**Confidence:** Medium-High  
**Status:** Confirmed via live settings + runtime path  
**Recommended priority:** Medium-High

### Evidence

Live breakpoint overrides:

- tablet: `cardGridColumns = 3`
- mobile: `cardGridColumns = 0`, `cardMaxColumns = 2`

Interpretation in the current runtime:

- tablet is forced to a fixed `3`-column row policy,
- mobile stays in auto mode but is capped at `2` columns,
- both breakpoints still inherit the same percentage-based width and gap configuration.

### Why this matters

The smaller breakpoints are not switching to a safer, more forgiving layout model. They are instead reusing the same shared width/gap values while also applying breakpoint-specific column behavior.

That is exactly the kind of combination that can look stable on desktop and fragile on narrower screens.

---

## Finding 6. The remaining uncertainty is whether the visual “overlap” is true geometric overlap or a near-zero-gap collapse amplified by the fixed-width flex branch

**Confidence:** Medium  
**Status:** Open follow-up  
**Recommended priority:** Medium

### Evidence pointing toward “near-zero-gap collapse”

- Live gap is only `2%`.
- Live effective width is roughly `15%` of container width.
- On mobile-sized containers, both numbers become very small in absolute pixel terms.

### Evidence pointing toward “flex-branch presentation quirk”

In the fixed-width branch, cards are rendered directly as flex items with:

```tsx
style={{
  width: '100%',
  ...(maxWidth ? { maxWidth: toCss(maxWidth, maxWidthUnit) } : {}),
}}
```

There is no explicit slot wrapper in the fixed branch equivalent to the responsive branch’s `flex: 0 0 responsiveCardWidth` wrapper.

That leaves one secondary possibility:

- the current fixed-width flex-item sizing is technically valid, but becomes visually unstable or browser-sensitive at very small effective widths.

### Why this matters

The document’s main conclusion does **not** depend on proving a browser-engine overlap bug. The stronger conclusion is already supported:

- the smaller breakpoints are inheriting a width/gap policy that becomes too compressed,
- and the runtime offers no breakpoint-aware safety guard.

But if the first-pass fix only partially improves the layout, this fixed-branch flex-item behavior is the next thing to inspect.

---

## Root Cause Summary

| Finding | Confidence | Root cause type | Recommended action |
|---|---|---|---|
| No mobile-only SCSS culprit | High | Rules out stylesheet-only diagnosis | Keep investigation centered on runtime sizing and settings |
| Tablet/mobile overrides only change columns | High | Rules out bad breakpoint width/gap/scale payload as the main explanation | Focus on shared width/gap/scale plus breakpoint column policy |
| Shared `10%` width + `1.5` scale + `2%` gap degrades sharply on narrow containers | High | Primary runtime sizing problem | Rework narrow-breakpoint handling for percent-based fixed card width and gap |
| No minimum-width or fallback guard in fixed-width branch | Medium-High | Primary resilience gap | Add a runtime floor or breakpoint-specific fallback path |
| Breakpoint overrides tighten row behavior on smaller screens | Medium-High | Secondary amplifier | Revisit tablet/mobile column strategy alongside width handling |
| Possible fixed-branch flex-item presentation quirk at very small widths | Medium | Secondary follow-up | Inspect only if the primary sizing fix does not fully solve the issue |

---

## Recommended Fix Plan

## Phase 1. Add a live-like automated regression before changing runtime behavior

### Goal

Capture the actual failing configuration in a focused test so the next fix is measurable.

### Test case shape

Use a narrow container and live-like settings values:

- `cardMaxWidth = 10`
- `cardMaxWidthUnit = '%'`
- `cardScale = 1.5`
- `cardGapH = 2`
- `cardGapHUnit = '%'`
- tablet override `cardGridColumns = 3`
- mobile override `cardGridColumns = 0`, `cardMaxColumns = 2`

### Target file

- `src/components/CampaignGallery/CardGallery.test.tsx`

### Acceptance criteria

- tablet/mobile rows retain visible horizontal separation,
- effective card width does not collapse below a usable floor,
- the test captures the exact regression shape instead of only generic responsive behavior.

---

## Phase 2. Choose the fix strategy for narrow breakpoints

There are three realistic implementation directions.

### Option A. Runtime guard for percent-based fixed-width cards on narrow breakpoints

**Recommended default direction**

Behavior:

- keep the current fixed-width behavior on desktop,
- but when `cardMaxWidth > 0` and `cardMaxWidthUnit === '%'`, evaluate the resolved width on the current container,
- if the result falls below a minimum usable threshold, switch to a safer layout strategy.

Possible safe responses:

- fall back to the responsive fill-column branch,
- reduce columns until the minimum width is satisfied,
- or clamp the resolved width to a breakpoint-aware minimum.

Why this is attractive:

- it solves the current user-facing issue without requiring manual data cleanup,
- it preserves the existing desktop behavior,
- it acknowledges that percentage-based fixed width is not equally viable at all container sizes.

### Option B. Breakpoint-specific configuration fix only

Behavior:

- leave the runtime alone,
- add tablet/mobile overrides so those breakpoints do not inherit the same fixed-width percent policy.

Examples:

- tablet/mobile set `cardMaxWidth = 0`, so the layout falls back to responsive fill mode,
- or tablet/mobile use larger explicit widths and larger gaps,
- or tablet/mobile lower their column count further.

Why this is weaker as the only fix:

- it depends on the saved configuration being manually corrected,
- it leaves the runtime free to regress again with similar settings,
- and it does not protect future users from the same narrow-container collapse.

### Option C. Hybrid approach

Behavior:

- add the runtime guard from Option A,
- and also revise the current tablet/mobile overrides or defaults so the live environment immediately behaves better.

Why this may be the best operational choice:

- it provides a code-level safety rail,
- while also making the active environment stop using a fragile configuration.

---

## Phase 3. Revisit percentage-based gap behavior in fixed-width rows

### Goal

Ensure that horizontal separation remains visibly meaningful on narrow breakpoints.

### Why this matters

The live gap value is `2%`, which can become only a few pixels once the row is narrow.

Possible fixes:

1. convert fixed-branch percentage gaps to resolved pixel gaps at runtime,
2. clamp percentage gaps to a minimum visible pixel gap,
3. or encourage tablet/mobile overrides to use px-based gaps instead of inheriting `%`.

### Recommendation

Treat this as part of the same narrow-breakpoint stabilization pass, not as a separate future cleanup item.

---

## Phase 4. Only if needed, inspect the fixed-width flex-item sizing behavior itself

### Goal

Avoid overcomplicating the first fix, but keep the next debugging step clear if the primary sizing guard only partially solves the problem.

### Secondary follow-up target

The fixed-width branch currently renders cards directly as flex items, while the responsive branch renders them through explicit slot wrappers.

If the primary fix does not fully eliminate the visual overlap impression, inspect whether the fixed-width branch should also use explicit wrappers with:

- an explicit flex basis,
- an explicit max width,
- and `minWidth: 0` or another more defensive flex-item sizing pattern.

---

## Suggested Verification Matrix

## Manual verification

### Tablet

1. Load the active site with the current saved settings.
2. View the card gallery at a tablet-sized container width.
3. Confirm whether three cards per row still show visible horizontal spacing.
4. After the fix, confirm the spacing remains visible and cards no longer read as overlapped.

### Mobile

1. Load the active site at a mobile-sized container width.
2. Confirm that the cards either:
   - render with visible horizontal spacing,
   - or safely fall back to a layout that avoids multi-card row collapse.

### Regression

1. Re-check desktop after the fix.
2. Confirm the current good desktop behavior is not degraded.
3. Confirm the earlier color-picker fix and card-column fix still behave correctly.

## Automated verification

Add or extend focused tests in:

- `src/components/CampaignGallery/CardGallery.test.tsx`

Recommended assertions:

- live-like percent-width + percent-gap settings do not collapse on a narrow container,
- tablet/mobile breakpoint overrides are applied as expected,
- the chosen fix preserves desktop behavior,
- and the fixed-width branch either clamps, falls back, or otherwise guards against unusably small effective widths.

---

## Files Most Likely To Change

### Primary runtime fix

- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/CampaignGallery/CardGallery.test.tsx`

### Possible secondary runtime hardening

- `src/components/CampaignGallery/CampaignCard.tsx`

### Optional settings-side follow-up

- `src/components/Settings/CampaignCardSettingsSection.tsx`

---

## Final Recommendation

Treat this as a narrow-breakpoint card-layout policy issue, not a generic mobile CSS regression.

The live evidence is strong:

- tablet/mobile are not using separately broken width or gap overrides,
- they are inheriting the same shared `10%` width, `2%` gap, and `1.5` scale as desktop,
- while also applying breakpoint-specific column behavior,
- and the runtime currently has no safety rail when that shared fixed-width percent configuration becomes too compressed on smaller containers.

The safest next implementation path is:

1. add a regression test using the live settings shape,
2. add a runtime guard or fallback for percent-based fixed-width cards on narrow breakpoints,
3. address percentage-gap visibility at the same time,
4. only then inspect deeper flex-item behavior if the visual overlap is not fully resolved.

That approach is consistent with the current codebase, matches the live saved configuration, and avoids blaming mobile/tablet-specific CSS when the stronger evidence points to shared layout math plus breakpoint row policy.

---

## Post-Implementation Update — 2026-04-04

This section records the state **after** the first-pass implementation landed.

Current user-observed outcome:

- mobile now appears acceptable,
- but tablet still reproduces the original card stacking/collision behavior.

That required a second-pass review of the **current implementation**, not just the pre-fix design.

### Additional Research Process

The follow-up review focused on the code that now exists in the repository.

Files reviewed:

- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/CampaignGallery/CampaignCard.tsx`
- `src/hooks/useBreakpoint.ts`
- `src/components/CampaignGallery/CardGallery.test.tsx`

The follow-up questions were:

1. Did the new narrow-breakpoint fallback actually wire itself into the render branch selection?
2. Does the current threshold cover tablet widths in practice, or mostly mobile only?
3. Do the tests actually prove that the renderer switches branches on narrow containers?
4. Are there any secondary implementation inconsistencies worth flagging while the tablet bug is being revisited?

### Updated Runtime Math

Current guard in `CardGallery.tsx`:

```tsx
const MIN_FIXED_CARD_WIDTH_PX = 120;
```

Current live settings still relevant to the bug:

- `cardMaxWidth = 10`
- `cardMaxWidthUnit = '%'`
- `cardScale = 1.5`

That means:

```txt
scaledValue = Math.round(10 * 1.5) = 15
resolved = Math.round(containerWidth * 15 / 100)
fallback when resolved < 120
```

The exact container-width cutoff is therefore approximately:

```txt
containerWidth < 796.67px  => fallback active
containerWidth >= 797px    => fixed-width branch remains active
```

This materially changes the interpretation of the first-pass fix:

- mobile widths are comfortably below the cutoff,
- only the bottom edge of tablet falls below the cutoff,
- most tablet widths remain in fixed-width mode.

### Updated Finding 1. The fallback branch is not wired correctly in rendering

**Confidence:** High  
**Status:** Confirmed implementation bug  
**Recommended priority:** Critical

### Evidence

The computed fallback can return `null`:

```tsx
if (resolved < MIN_FIXED_CARD_WIDTH_PX) return null;
```

But the renderer still selects the fixed-width path using the original boolean:

```tsx
if (hasFixedCardWidth) {
  return (
    <CampaignCard
      ...
      maxWidth={fixedCardWidth?.value}
      maxWidthUnit={fixedCardWidth?.unit}
    />
  );
}
```

That means the code can enter the fixed-width branch even when the computed fallback has already decided fixed-width is too small.

### Why this matters

This is a real implementation defect, not just a product-tuning question.

When `fixedCardWidth` becomes `null`:

- the grid container correctly stops applying fixed-width row constraints,
- but the individual card render path still behaves as if fixed-width mode were active,
- and the card ends up receiving `undefined` width props instead of cleanly moving into the responsive wrapper branch.

### Practical implication

The improved mobile result may be partly accidental.
Instead of a fully intentional responsive branch switch, the current code can fall into a hybrid state where cards lose their explicit max width but do not gain the responsive branch wrapper that was supposed to replace it.

### Updated Finding 2. The current 120px guard barely affects tablet in practice

**Confidence:** High  
**Status:** Confirmed  
**Recommended priority:** Critical for the user-facing tablet bug

### Evidence

Tablet breakpoint in `useBreakpoint.ts` is:

- `768px <= width < 1200px`

But the current guard only activates below roughly `797px` container width.

That means tablet behavior splits like this:

- `768px` to `796px`: fallback eligible
- `797px` to `1199px`: fixed-width branch remains active

So only the smallest slice of tablet gets the intended protection.

### Why this matters

This explains the current real-world outcome very cleanly:

- mobile improves because it is comfortably under the cutoff,
- tablet still looks broken because almost the entire tablet range never leaves the fixed-width percent-width strategy.

In other words, even if the branch-selection bug were corrected, the current threshold still leaves most tablet widths exposed to the original design problem.

### Updated Finding 3. The current tests do not prove that fallback actually switches branches

**Confidence:** High  
**Status:** Confirmed test coverage gap  
**Recommended priority:** High

### Evidence

The new narrow-breakpoint tests in `CardGallery.test.tsx` do check for cases where:

- fixed-width stays active on a wide container,
- and the narrow-path card ends up with no inline `maxWidth`.

But they do **not** prove that the component actually switched into the responsive wrapper branch.

Why the current test can still pass when the renderer is wrong:

- `CampaignCard.tsx` only applies `maxWidth` when the value is truthy,
- so a broken branch that passes `undefined` still yields an empty `style.maxWidth`,
- which looks the same to the current assertion as a correct responsive-branch render.

### Why this matters

The existing test suite can report success even while the branch-selection bug remains active.

There is also still no direct coverage for representative tablet widths such as:

- `797px`
- `820px`
- `900px`
- `1024px`

Those are the widths that matter most to the current unresolved bug.

### Updated Finding 4. The fixed-width row maxWidth and rendered gap are now inconsistent

**Confidence:** Medium-High  
**Status:** Confirmed secondary implementation issue  
**Recommended priority:** Medium

### Evidence

The rendered horizontal gap can clamp to a minimum `4px` when a percentage gap resolves too small.

But the row `maxWidth` calculation still uses the raw gap expression:

```tsx
maxWidth: `calc(${toCss(maxCols * fixedCardWidth.value, fixedCardWidth.unit)} + ${toCss((maxCols - 1) * s.cardGapH, cardGapHUnit)})`
```

That means the row width constraint and the actually rendered gap can diverge.

### Why this matters

This is not the primary reason tablet still looks broken, but it is a real inconsistency:

- the visible gap can be clamped,
- while the row width constraint still assumes the unclamped value.

That makes narrow fixed-width rows harder to reason about and can produce subtle layout drift.

---

## Revised Recommendation After Implementation Review

The implementation review changes the priority order slightly.

### Immediate code bug to fix

1. Make the render branch key off the computed `fixedCardWidth`, not only `hasFixedCardWidth`.

This is the clear correctness bug in the current implementation.

### Immediate tablet strategy to revisit

2. Do **not** assume that fixing the branch-selection bug alone will solve tablet.

The current `120px` floor is too low to protect most of the tablet range for the live settings. If the goal is to make tablet reliably safe, one of these needs to happen:

- raise the minimum usable card-width floor,
- add a tablet-specific fallback rule for percent-based fixed-width cards,
- or add an explicit tablet override such as `cardMaxWidth = 0` so tablet uses the responsive fill-column branch.

### Immediate test follow-up

3. Extend `CardGallery.test.tsx` so it verifies:

- branch switching, not just empty `maxWidth`,
- and representative tablet widths above and below the real cutoff.

### Secondary cleanup while touching the same code

4. Align the fixed-width row `maxWidth` calculation with the actual clamped effective gap used for rendering.

---

## Updated Bottom Line

The first-pass implementation did not fully solve the tablet problem for two separate reasons:

1. a real render-branch bug means the new fallback is not wired cleanly,
2. and the chosen threshold only protects a very small slice of the tablet breakpoint.

So the current state should be understood as:

- mobile improvement: real user-visible improvement, but likely achieved through an incomplete branch path,
- tablet failure: still expected under the current threshold and live settings,
- implementation quality: partially improved, but not yet internally consistent or fully covered by tests.

---

## Implementor Evaluation — Claude Opus 4.6 — 2026-04-04

### Agreement summary

All four updated findings are confirmed correct after independent code review.

- **Updated Finding 1 (branch selection bug):** Confirmed critical. The render loop uses `hasFixedCardWidth` (a static boolean from `s.cardMaxWidth > 0`) instead of the computed `fixedCardWidth` which can be `null` after the guard fires. Cards enter the fixed-width path with `undefined` props instead of getting the responsive `<Box>` wrapper with `flex: 0 0` sizing. This is the primary correctness bug.
- **Updated Finding 2 (120px threshold too low for tablet):** Confirmed. The math is `120 / 0.15 ≈ 797px`, so only the 768–796px slice of tablet (768–1199px) gets protection. However, see threshold decision below.
- **Updated Finding 3 (test gap):** Confirmed. Asserting `maxWidth === ''` passes identically whether the card correctly entered the responsive branch or incorrectly entered the fixed-width branch with `undefined` props. Tests need to verify wrapper presence.
- **Updated Finding 4 (gap inconsistency):** Confirmed minor. The row `maxWidth` calc uses raw `cardGapH` while the rendered `gap` can be clamped to `4px`. Worth fixing for consistency.

### Decisions

**D1. Branch selection — fix by keying off `!!fixedCardWidth` instead of `hasFixedCardWidth`.**

One-line change in the card render loop. This is the critical correctness fix. The grid wrapper already correctly checks `fixedCardWidth` (not the boolean), so the wrapper-level behavior is fine — only the per-card branch needs the fix.

**D2. Threshold — keep at 120px for now, do not raise.**

The audit correctly identifies that 120px only protects a narrow slice of tablet for the current live settings. However, raising the threshold is a product-level decision with broader consequences:

- A higher threshold (e.g. 200px) would force more configurations into the responsive branch, potentially surprising users who intentionally chose small fixed-width cards on desktop.
- The branch-selection fix (D1) was never actually switching branches on tablet — the guard was firing but the render path ignored it. We have never seen the correct behavior on tablet. Fixing D1 may itself resolve the visual issue because the responsive branch distributes cards using `calc()` which handles narrow containers natively.
- If tablet still looks bad after D1 is wired correctly, the next move should be a breakpoint-aware threshold or tablet-specific responsive override, not a global threshold bump.

Plan: fix D1, deploy, verify tablet. Revisit threshold only if still needed.

**D3. Gap inconsistency — extract effective gap into a shared variable.**

The clamped gap expression is currently inline in the `gap` style. Extract it into a `const effectiveGapH` used by both the rendered `gap` property and the row `maxWidth` calc. Small change, eliminates the inconsistency.

**D4. Tests — assert wrapper presence, add tablet-width cases.**

Add a `data-testid` to the responsive wrapper `<Box>` so tests can distinguish which branch rendered. Add test cases at representative tablet widths (e.g. 900px where the guard does NOT fire, proving the fixed-width branch is correctly retained on wide tablets).