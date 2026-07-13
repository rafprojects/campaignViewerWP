# WP Super Gallery — Manual Assistive-Technology (AT) Audit

**A living, follow-along QA script for the WCAG 2.1 AA criteria that automated tooling can't verify**
(keyboard operability, focus management, real screen-reader output, Shadow-DOM exposure, motion,
reflow). Automated coverage (theme-contrast gate, axe structural checks) is described in
[ACCESSIBILITY.md](ACCESSIBILITY.md) — this doc is the **human** half of the P62-H track.

> **Status:** living document — started 2026-07-11. We add surfaces/checks as coverage grows.
> Track progress in §8 (Coverage tracker) and log issues in §7. Nothing here blocks a launch on its
> own — WCAG AA is the project's quality bar (see [PHASE62_REPORT.md](../PHASE62_REPORT.md) P62-H).

---

## 1. How to use this doc

1. Pick a surface from §4–§6 and work top-to-bottom through its checks.
2. For each check, mark the result: **✅ pass** / **❌ fail** / **⚠️ partial** / **n/a**.
3. On a fail/partial, add a row to the **Issue log** (§7) — one row per distinct problem.
4. Update the **Coverage tracker** (§8) when you finish (or partially finish) a surface.
5. Re-run a surface after fixes land; keep the log's "Status" column current.

You do **not** need to be an accessibility expert. Each check tells you *what to do* and *what a pass
looks like*. When in doubt, log it as ⚠️ with a note and we'll triage.

---

## 2. Set up your test environment

### Screen readers (use at least one; two is better)

| OS | Screen reader | Best browser | Turn on/off |
|---|---|---|---|
| Windows | **NVDA** (free — download from nvaccess.org) | Firefox (or Chrome) | Ctrl+Alt+N / NVDA menu → Exit |
| macOS | **VoiceOver** (built in) | Safari | **⌘+F5** toggles it |

**Minimum screen-reader commands you'll need:**

- **NVDA** (modifier = `Insert` or `CapsLock`): `Tab`/`Shift+Tab` move focus · `H` next heading · `D` next
  landmark · `F` next form field · `B` next button · `K` next link · `NVDA+Space` toggle browse/focus
  mode · `NVDA+F7` elements list · `Insert+Down` read from here.
- **VoiceOver** (modifier `VO` = `Ctrl+Option`): `VO+→`/`VO+←` navigate · `VO+U` rotor (headings /
  landmarks / form controls / links) · `VO+Space` activate · `Ctrl+Option+Cmd+H` next heading.

### Keyboard-only basics (used everywhere)

`Tab` / `Shift+Tab` move focus · `Enter` activate buttons/links · `Space` activate buttons, toggle
checkboxes · `Esc` close/cancel · `Arrow keys` within composite widgets (menus, tabs, sliders,
segmented controls, radios) · `Home`/`End` first/last.

### Visual tooling

- **Zoom:** `Ctrl/⌘ +` to 200% (WCAG 1.4.4 / 1.4.10).
- **Reflow at 320px:** browser DevTools → device toolbar → set width **320px**.
- **Reduced motion:** OS setting (*Reduce motion*), or Chrome DevTools → **Rendering** → "Emulate CSS
  `prefers-reduced-motion: reduce`".
- **Focus visibility:** just watch for a clear focus ring as you `Tab`.

### Launching the app (real render required — not Storybook)

- **Full WordPress context:** `npx wp-env start`, then log into `http://localhost:8888/wp-admin`
  (admin surfaces) and put `[super-gallery campaign="<slug>"]` on a page for the public embed. See
  `docs/testing/TESTING_QUICKSTART.md`.
- **Shadow-DOM toggle:** the public gallery mounts in an **open shadow root** by default; append
  **`?shadow=0`** to the page URL to render without shadow DOM (compare AT behaviour with/without).
- **Themes:** switch the active theme in Settings; spot-check a **light**, a **dark**, and the
  **high-contrast** theme. Token contrast is already AA-gated, so focus manual contrast checks on
  component *states* (hover/disabled/selected) and any imagery.

---

## 3. Global / cross-cutting checks (run once per session, on any surface)

| # | Check (WCAG) | How | Pass looks like | Result |
|---|---|---|---|---|
| G1 | **Focus visible** (2.4.7) | `Tab` through the whole surface | Every focusable control shows a clear, high-contrast focus ring; focus never "disappears" | |
| G2 | **No keyboard trap** (2.1.2) | `Tab` forward through everything, then `Shift+Tab` back out | Focus can always move on and escape any widget/modal (via Tab or Esc) | |
| G3 | **Focus order** (2.4.3) | `Tab` slowly, watch the order | Order follows the visual/reading order; no wild jumps | |
| G4 | **Zoom 200%** (1.4.4) | `Ctrl/⌘ +` to 200% | No clipped text, no overlap, all controls usable | |
| G5 | **Reflow 320px** (1.4.10) | DevTools width 320px | No horizontal scroll for content; nothing lost or unusable | |
| G6 | **Reduced motion** (2.3.3) | Enable *reduce motion*, reload | Carousel autoplay, entrance/scroll-reveal, tilt/glow, and builder transitions are stilled or greatly reduced | |
| G7 | **Non-text contrast** (1.4.11) | Eyeball focus rings, icons, input borders | Focus indicators and meaningful icons/borders have ≥3:1 against their background | |
| G8 | **`outline:none` audit** | Cross-check the 8 `outline:none` spots (see [ACCESSIBILITY.md](ACCESSIBILITY.md) §2) | Each has a visible `:focus-visible` replacement — none removes focus indication outright | |

---

## 4. Public surfaces

### 4A. Gallery listing page (campaign cards)

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| P-L1 | Keyboard reach | `Tab` from page top | Every card / control is reachable and activatable with keyboard | |
| P-L2 | Card semantics (1.3.1, 4.1.2) | Screen-reader through a card | Card announces a meaningful name (campaign title); it's a link/button, not a bare div | |
| P-L3 | Images (1.1.1) | SR over thumbnails | Decorative images are silent; meaningful images have alt text | |
| P-L4 | Headings (1.3.1, 2.4.6) | NVDA `H` / VO rotor | A sensible heading structure exists (no skipped levels for the visible hierarchy) | |
| P-L5 | Pagination / load-more | Keyboard activate | "Load more" / pagination is reachable, operable, and announces new content (see 4.1.3) | |

### 4B. Lightbox / media viewer

The lightbox renders as `role="dialog"` labelled **"Media lightbox"**, with an `aria-live` position
counter (added in P54-C).

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| P-B1 | Open + focus move (2.4.3) | Open the lightbox via keyboard | Focus moves into the dialog on open | |
| P-B2 | Focus trap (2.1.2) | `Tab` repeatedly | Focus cycles **within** the lightbox; doesn't leak to the page behind | |
| P-B3 | Close + focus return | Press `Esc` and the close button | Both close it; focus returns to the element that opened it | |
| P-B4 | Dialog name (4.1.2) | SR on open | Announced as a dialog named "Media lightbox" | |
| P-B5 | Position announced (4.1.3) | Arrow to next/prev image | The "N of M" counter is announced via `aria-live` on change | |
| P-B6 | Arrow navigation (2.1.1) | Left/Right arrows | Prev/next work by keyboard; overlay arrow buttons are reachable | |
| P-B7 | Caption (1.1.1) | SR | Caption text is announced / associated with the image | |

### 4C. Campaign viewer / carousel

The carousel is an Embla region with `role="region"` + label (P54-C).

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| P-C1 | Region label (1.3.1) | SR lands on the carousel | Announced as a labelled region | |
| P-C2 | Keyboard control (2.1.1) | Tab to it, arrows / prev-next | Slides change by keyboard; controls reachable | |
| P-C3 | Autoplay + motion (2.2.2, 2.3.3) | Watch; enable reduce-motion | Autoplay is pausable/stoppable; reduce-motion halts autoplay | |
| P-C4 | Dot navigator (4.1.2) | SR + keyboard | Dots have names/state (current slide) and are operable | |

### 4D. Auth bar + login modal (JWT mode)

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| P-A1 | Auth bar reach | `Tab` | Sign-in control reachable + labelled | |
| P-A2 | Login dialog (4.1.2) | Open it | `role="dialog"`, named; focus moves in; Esc closes; focus returns | |
| P-A3 | Form labels (1.3.1, 3.3.2) | SR each field | Every field has a programmatic label (not placeholder-only) | |
| P-A4 | Error messaging (3.3.1, 4.1.3) | Submit empty/invalid | Errors are announced and associated with the field | |

### 4E. Shadow-DOM exposure (the biggest untested risk)

The public gallery is inside an **open** shadow root. ARIA IDs (`aria-labelledby`/`aria-controls`/
`aria-describedby`) do **not** cross the shadow boundary.

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| P-S1 | Region exposed | SR-navigate the host page | The gallery content is reachable/announced in the host page's AT tree | |
| P-S2 | ARIA references resolve (1.3.1, 4.1.2) | SR over labelled controls inside the gallery | Controls relying on `aria-labelledby`/`-controls` announce correctly (IDs resolve **within** the shadow root, not to the light DOM) | |
| P-S3 | With vs without shadow | Compare `?shadow=0` vs default | AT behaviour is equivalent; no regression unique to the shadow path | |
| P-S4 | Live regions across boundary (4.1.3) | Trigger an `aria-live` update inside the gallery | The announcement still fires with shadow DOM on | |

---

## 5. Admin surfaces

### 5A. Admin Panel (tabbed)

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| A-P1 | Tab widget (4.1.2, 2.1.1) | Arrow keys on the tab strip | Tabs use `role="tab"`/`tablist`/`tabpanel`; arrow keys move between tabs; selected state announced | |
| A-P2 | Each tab's content reachable | `Tab` through campaigns / media / access / analytics / audit | All controls reachable + operable by keyboard | |
| A-P3 | Data tables (1.3.1) | SR over a table | Column headers announced with cells (th/scope) | |
| A-P4 | Sort/filter controls (4.1.2) | SR + keyboard | Named, operable; state (sort direction / active filter) announced | |
| A-P5 | Bulk actions | Keyboard | Multi-select + action controls reachable and labelled | |

### 5B. Settings panel

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| A-S1 | Accordion/drawer (4.1.2) | Keyboard expand/collapse | Sections are keyboard-operable; expanded state announced | |
| A-S2 | Form controls (1.3.1, 3.3.2) | SR each control | Every input/select/switch/segmented-control has a label; grouping via fieldset/legend where relevant | |
| A-S3 | Segmented controls (4.1.2) | Arrow keys | Operable by keyboard; current option announced (note: contrast of inactive labels is now AA-gated) | |
| A-S4 | Live preview updates (4.1.3) | Change a setting | Preview changes don't steal focus; meaningful changes announced if needed | |

### 5C. Modals (general pattern — applies to ~36 modals)

Test 2–3 representative modals (e.g. Unified Campaign, Gallery Config Editor, a confirm dialog).

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| A-M1 | Focus move-in | Open | Focus moves into the modal | |
| A-M2 | Focus trap (2.1.2) | `Tab` cycle | Focus stays within the modal | |
| A-M3 | Close paths | `Esc`, close button, overlay | Close button has a name (global default set in P60-D); focus returns to the trigger | |
| A-M4 | Dialog name (4.1.2) | SR | Announced as a dialog with a meaningful name | |
| A-M5 | Nested/stacked modals | Open a modal from a modal | Focus + Esc behave correctly across the stack | |

---

## 6. LayoutBuilder (heaviest surface — canvas + dockview panels)

The builder is a dockview app (Canvas / Layers / Media / Properties panels) with a drag/drop,
absolutely-positioned canvas. **Known:** the builder modal sets `closeOnEscape={false}` (dismiss via
its close button). Text layers, per-breakpoint editing, and the preset gallery are **Pro** (absent
from the free build) — audit them in a Pro/dev build.

| # | Check | Steps | Pass | Result |
|---|---|---|---|---|
| L1 | Enter/exit (2.1.2) | Open the builder; try to leave | Focus enters; the modal is dismissible by keyboard via its close button; focus returns | |
| L2 | Panel reachability | `Tab` across dockview panels | Each panel (Canvas/Layers/Media/Properties) and its controls are reachable | |
| L3 | Canvas operability (2.1.1, 2.5.7) | Try to add/select/move/resize a slot **by keyboard** | Slots can be selected and manipulated without a mouse — **or** a documented keyboard alternative exists to the drag/drop | |
| L4 | Layer list (4.1.2) | SR + keyboard on the Layers panel | Layers have names/roles; reorder/visibility/lock controls are labelled + operable | |
| L5 | Properties panel (1.3.1, 3.3.2) | SR each field | Position/size/typography/etc. inputs are labelled | |
| L6 | Selection announced (4.1.3) | Select a slot/layer | The current selection is conveyed to AT (not colour-only) | |
| L7 | Pro upsell gating (build-dependent) | Free build: the add-text / breakpoint / preset controls | In the free build they're absent; in Pro they're operable and labelled | |

> **Note:** the canvas drag/drop is the highest-risk area for keyboard/AT. If keyboard manipulation
> isn't feasible today, log it (L3) as a known gap with the intended remediation (keyboard nudge/resize
> or an accessible alternative), rather than blocking.

---

## 7. Issue log

One row per distinct problem. Severity: **Blocker** (fails a core task) / **Serious** / **Moderate** /
**Minor**.

| ID | Date | Surface / check | WCAG | AT + browser | What happened (expected vs actual) | Severity | Status |
|---|---|---|---|---|---|---|---|
| _e.g. A11Y-001_ | 2026-07-11 | L3 (builder canvas) | 2.1.1 | NVDA + FF | Can't move a slot by keyboard; drag only | Serious | Open |
|  |  |  |  |  |  |  |  |

---

## 8. Coverage tracker

| Surface | Keyboard | Focus mgmt | Screen reader | Contrast states | Reduced motion | Zoom/reflow | Last run | By |
|---|---|---|---|---|---|---|---|---|
| 4A Gallery listing | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — |
| 4B Lightbox | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — |
| 4C Carousel / viewer | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — |
| 4D Auth / login | ⬜ | ⬜ | ⬜ | ⬜ | n/a | ⬜ | — | — |
| 4E Shadow-DOM | ⬜ | ⬜ | ⬜ | n/a | n/a | ⬜ | — | — |
| 5A Admin Panel | ⬜ | ⬜ | ⬜ | ⬜ | n/a | ⬜ | — | — |
| 5B Settings | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — |
| 5C Modals | ⬜ | ⬜ | ⬜ | ⬜ | n/a | ⬜ | — | — |
| 6 LayoutBuilder | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — |

Legend: ⬜ not started · 🟡 partial · ✅ done. Update after each run.

---

## 9. Changelog (living doc)

- **2026-07-11** — Doc created (P62-H). Sections: setup, global checks, public/admin/builder surfaces,
  Shadow-DOM, issue log, coverage tracker. Seeded from the code-level static review in
  [ACCESSIBILITY.md](ACCESSIBILITY.md) §2. _Next candidates to add: per-adapter gallery checks
  (14 adapters), theme-by-theme contrast-state spot-checks, and a WP-admin landmark decision._
