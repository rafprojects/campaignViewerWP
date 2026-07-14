# WP Super Gallery — Accessibility (WCAG AA)

**Audience:** developers/maintainers. What's automated and gated, what the P62-H pass changed,
and the remaining **human** assistive-technology (AT) audit that automated tooling can't cover.

WCAG AA is the project's **quality bar** for a public listing (see
[../PHASE62_REPORT.md](../PHASE62_REPORT.md) P62-H). It is **not** a hard WordPress.org submission
gate, so the WP.org "lite" tier can launch before the manual AT audit below is complete.

---

## 1. Automated coverage & gates

| Check | What it enforces | Where | Blocking? |
|---|---|---|---|
| **Theme-token contrast** (P62-H) | Every theme's intended text/background pairs meet WCAG AA (4.5:1) | `packages/theme-engine/src/contrastAudit.ts` + `contrastAudit.test.ts` | **Yes** — Vitest CI (fast, no browser) |
| **Structural axe** | critical/serious roles/names/labels/ARIA validity **+ color-contrast** across 6 flows | `e2e/accessibility.spec.ts` (`@axe-core/playwright`) | No — manual `e2e.yml` (`workflow_dispatch`) |
| **Modal close-button names** | `aria-label` on every Mantine `CloseButton` (P60-D) | `src/main.tsx` (global default) | via axe |
| **Dynamic announcements** | 19 `aria-live` / `role=status\|alert` regions (e.g. lightbox position counter, P54-C) | across `src/` | via axe |
| **Component structural axe** (jsdom) | roles / names / labels / ARIA on rendered components (WCAG A/AA; contrast excluded) | `src/test/axe.ts` + per-component `*.test.tsx` | **Yes** — Vitest CI (coverage growing) |

### The contrast gate (P62-H, 2026-07-11)

Contrast (WCAG 1.4.3) was previously **disabled** in the axe suite. It is now enforced two ways:

- **Deterministic, blocking:** `contrastAudit.test.ts` iterates all 23 bundled themes and asserts
  each intended pair — `text` / `textMuted` / `textMuted2` on the surface layers + body background,
  and the primary-button label — meets 4.5:1, reusing the WCAG math in
  `packages/theme-engine/src/validation.ts` (`contrastRatio`). The intended pairs are modelled in
  `contrastAudit.ts` from the Mantine adapter's fg/bg co-locations (`src/themes/adapter.ts`) and the
  builder shell tokens (`useBuilderShellColors`). A token change that drops below AA fails CI.
- **Runtime:** `color-contrast` is re-enabled in the e2e axe suite (manual), adding real-render
  contrast coverage on top of the token-level gate.

**What the P62-H pass changed:** the audit found muted text below AA on secondary surfaces in **18 of
23 themes** (a systematic design pattern). All 18 were fixed with minimal, hue-preserving bumps to the
**foreground** text tokens only (`textMuted`/`textMuted2`, and `text` in darcula/tokyo-night/
forest-whisper) — never surfaces/backgrounds, so elevation and palette identity are preserved. Muted
text is now slightly higher-contrast across the theme library.

### Component structural axe harness (P62-H, 2026-07-11)

A jsdom axe harness runs structural WCAG A/AA checks (roles, accessible names, form labels, ARIA
validity — **not** contrast, which jsdom can't compute) over rendered components in the fast Vitest CI.

- **Helper:** `src/test/axe.ts` → `await expectNoA11yViolations(container)`. It runs axe with the WCAG
  A/AA tag set and disables `color-contrast` (covered by the theme-contrast gate) and landmark/`region`
  best-practice rules (components render in isolation, not full pages).
- **Add coverage:** in any component's `*.test.tsx`, render via the shared `@/test/test-utils` `render`
  (which now mirrors the app's global CloseButton `aria-label` default so modal a11y tests are
  accurate), then `await expectNoA11yViolations(container)`. i18n any new accessible-name string per
  [PRO_FEATURES.md](PRO_FEATURES.md) §5.
- **Gated today:** `ConfirmModal`, `LayoutBuilderLayersPanel` — the harness's first clean surfaces.

**Structural a11y backlog (grow the gate; concrete issues the harness already found):**

| Surface | Issue axe found | WCAG | Fix |
|---|---|---|---|
| `LayoutTemplateList` view toggle | icon-only `SegmentedControl` segments have no accessible name (`label`, critical) | 4.1.2 | Give each segment an i18n'd name (visually-hidden text or aria-label — needs the 5-locale i18n step) |
| `LayoutTemplateList` template card | `role="button"` Card nests a Menu button → `nested-interactive` (serious) | 4.1.2 | Restructure so the card's primary action is a real button/link (e.g. on the title), not a button wrapping buttons |
| **Not yet covered** | — | — | Add `expectNoA11yViolations` to the LayoutBuilder property panels (Slot/Text/Graphic/Mask/Background/Image), the modals (`GalleryConfigEditorModal`, `UnifiedCampaignModal`, campaign/admin modals), `AdminPanel`, `SettingsPanel`, and the gallery adapters — fixing what each surfaces |

Expect each newly-covered surface to surface its own fixes (often missing form labels or nested
interactives); treat this as a **living gate** that grows component-by-component.

---

## 2. Static review findings (P62-H, code-level)

These are code-level observations to resolve or verify during the manual audit (§3). They were **not**
auto-fixed — each needs real AT/keyboard verification, and some are nuanced by the WP-admin host context.

| Finding | WCAG | Notes |
|---|---|---|
| **No plugin-owned ARIA landmarks** (`<main>`/`<nav>`/`role=…`) | 1.3.1 / 2.4.1 | The admin SPA renders inside WP-admin, which supplies its own landmarks; adding competing ones could regress. The **public embed** (Shadow DOM) is the real gap — verify the host page's landmark tree still exposes the gallery region. |
| **`closeOnEscape={false}`** on `LayoutBuilderModal` (`:466`) | 2.1.2 | Deliberate (avoid discarding edits). Not a hard keyboard trap — focus is trapped by Mantine but the modal is dismissible via its close button. Confirm the close button is keyboard-reachable and focus returns to the trigger. |
| **8 × `outline: none`** in components/CSS | 2.4.7 | Each must have a visible `:focus-visible` replacement. Enumerate and verify none removes focus indication outright. |
| **No skip-to-content link** | 2.4.1 | WP-admin provides its own; low priority for the admin SPA. N/A for the shadow-DOM embed. |

Positive signals: **no positive `tabIndex`** anywhere (no tab-order anti-pattern); dynamic content uses
`aria-live` (§1).

---

## 3. Human AT-audit checklist (the deferred, non-automatable part)

Automated tooling (axe) cannot verify focus order, keyboard operability, real screen-reader output, or
ARIA exposure across the Shadow-DOM boundary. Run this manually with a real AT stack (NVDA + Firefox
and VoiceOver + Safari) before declaring full AA.

> **Follow the step-by-step QA script:** [ACCESSIBILITY_MANUAL_AUDIT.md](ACCESSIBILITY_MANUAL_AUDIT.md)
> — a living doc with AT setup, per-surface test scripts (with expected results), an issue log, and a
> coverage tracker. The list below is the short version.

- [ ] **Keyboard-only walkthrough** of each surface: gallery listing, lightbox, campaign viewer, Admin
      Panel (all tabs), Settings, and the **LayoutBuilder** (the heaviest surface — drag/drop canvas,
      absolutely-positioned layers). Every action reachable + operable without a mouse.
- [ ] **Focus management:** focus traps in every modal; focus returns to the trigger on close; no focus
      loss on route/tab change; visible focus indicator everywhere (cross-check the `outline:none` list).
- [ ] **Screen-reader walkthrough** of the same surfaces: headings/labels/roles announced correctly;
      state changes announced (`aria-live`); no unlabeled controls; images have appropriate alt/roles.
- [ ] **Shadow-DOM SR exposure:** the public gallery mounts in an **open** shadow root
      (`src/main.tsx`). Verify ARIA references (`aria-labelledby`/`aria-controls`) resolve **within** the
      shadow root (IDs don't cross the boundary), and that the gallery region is exposed to the host
      page's AT tree. This is the biggest untested risk.
- [ ] **Contrast in real renders** across a sample of themes (the token gate covers palette pairs; check
      component states — hover/disabled/selected — and any hardcoded/Mantine-default colors).
- [ ] **Reduced motion:** `prefers-reduced-motion` respected for carousel autoplay, entrance animations,
      and builder transitions.
- [ ] **Zoom/reflow (1.4.10):** usable at 200% zoom / 320px width without loss of content or function.

Record results and fixes back in [../PHASE62_REPORT.md](../PHASE62_REPORT.md) P62-H.
