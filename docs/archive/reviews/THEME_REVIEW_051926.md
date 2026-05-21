# Theme System Review — 2026-05-19

## Scope

This review evaluates the current theme runtime, selector UX, WordPress settings
integration, and theme QA strategy. The goal is to decide which proposals should
be accepted, changed, expanded, rejected, or deferred based on the code that
exists today.

---

## Validated Strengths

The core architecture is solid and should be preserved.

| Area | Assessment |
|------|------------|
| Pre-computed registry | Strong. The runtime gets O(1) theme switching from a startup-time registry in `src/themes/index.ts`. |
| Base-merge theme model | Strong. `_base.json` keeps theme definitions compact and consistent. |
| Adapter pattern | Strong. `src/themes/adapter.ts` centralizes JSON → Mantine conversion and auto-generated component overrides. |
| CSS variable bridge | Strong. Mantine variables and custom `--wpsg-*` variables are cleanly separated for Shadow DOM support. |
| Preview vs persist behavior | Strong. `setPreviewTheme()` and `setTheme()` are correctly separated in `src/contexts/ThemeContext.tsx`. |
| Fallback behavior | Strong. `useTheme()` and the registry both fail safely. |
| Runtime validation | Strong baseline. `src/themes/validation.ts` already catches malformed theme definitions well. |
| Accessibility inclusion | Strong. Shipping a dedicated `high-contrast` theme is the right design choice. |

These strengths are the reason the follow-on work should focus on catalog
unification, runtime hardening, and QA rather than replacing the theme system.

---

## Additional Findings

### 1. Theme catalog drift is the real grouping problem

The React and WordPress theme surfaces are not missing all grouping logic; they
are using different sources of truth.

- `src/themes/index.ts` registers 23 bundled themes.
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`
  validates all 23 theme IDs.
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-core-fields.php`
  renders a grouped selector, but only for an older subset of themes.
- `src/components/Admin/ThemeSelector.tsx` renders a flat selector with no shared
  metadata beyond `ThemeMeta`.

Conclusion: the next step is not “add categories” in isolation. The next step is
to create one packaged catalog that both TypeScript and PHP consume.

### 2. Documentation has drifted with the implementation

- Code comments still point to `docs/old/THEME_SYSTEM_ASSESSMENT.md` as the gold
  source.
- `docs/testing/THEME_QA_GUIDE.md` still describes a 14-theme grouped world.
- This review itself needed to become a decision record rather than remain a raw
  idea list.

### 3. Theme QA should reuse the existing stable Playwright path

The repo already has a stable mocked Shadow DOM browser harness in
`e2e/mantine8-runtime-qa.spec.ts`. Theme visual regression should build on that
path instead of inventing a separate theme-demo surface.

---

## Proposal Decisions

### Runtime & Foundation

| # | Proposal | Decision | Rationale | Track |
|---|----------|----------|-----------|-------|
| 1 | Fix Shadow DOM style element creation and cleanup | Accept | This is a real lifecycle bug in `ThemeContext.tsx`, not a speculative improvement. | P30-I |
| 2 | Change `deepMerge` null handling | Change | Treat this as runtime custom-theme API hardening for `registerCustomTheme`, not as a bundled-theme defect. | P30-I |
| 3 | Update stale “14 themes” comment | Accept | Low-risk cleanup and part of broader doc/runtime alignment. | P30-I |
| 4 | Rework `generateColorScale` saturation edge case | Defer | There is not enough evidence of a current defect. Revisit only if neutral palette regressions appear. | Deferred |
| 5 | Lazy or tree-shakeable theme registration | Reject | Complexity and async surface area are not justified for 23 bundled themes. | Rejected |

### Catalog, Selector, and UX

| # | Proposal | Decision | Rationale | Track |
|---|----------|----------|-----------|-------|
| 6 | Add theme categorization/grouping | Change | Grouping already exists in WordPress settings, but it is stale and disconnected from React. Unify both surfaces from one catalog. | P30-H |
| 7 | Add theme preview thumbnails | Defer | Useful follow-on, but lower value than catalog unification and swatch/description cleanup. | Deferred |
| 8 | Add font/theme pairing recommendations | Reject | The current typography baseline is intentionally stable; this is low ROI now. | Rejected |
| 9 | Add a custom theme builder UI | Defer | Keep the runtime custom-theme API path, but do not add UI authoring in this phase. | Deferred |
| 10 | Add system `prefers-color-scheme` detection | Change | If added later, it should be explicit `system` behavior or fallback-only. It must not silently override saved or WP-injected themes. | Deferred follow-on |
| 11 | Auto-hide seasonal themes outside October | Change | Keep seasonal themes always visible in a dedicated group. Do not add date-based hiding logic now. | P30-H |
| 12 | Replace current selector swatches | Accept | The current swatch set is weak. Use more distinctive metadata-driven swatches. | P30-H |
| 13 | Add keyboard shortcut theme switching | Reject | Low value, higher conflict risk, and not needed before catalog/QA work lands. | Rejected |
| 14 | Improve generic selector descriptions | Accept | Descriptions should come from theme metadata, not only from light/dark scheme. | P30-H |
| 15 | Add favorites or recent themes | Defer | Useful power-user polish, but not before catalog alignment and regression coverage. | Deferred |
| 16 | Add theme transition animation | Change | Any transition work should be scoped and component-aware, not a global `* { transition }` rule. | Deferred follow-on |

### Validation & QA

| # | Proposal | Decision | Rationale | Track |
|---|----------|----------|-----------|-------|
| 17 | Add build-time schema validation | Accept | Runtime validation is good, but build-time checks should protect both theme definitions and the new shared catalog. | P30-I |
| 18 | Add contrast ratio validation | Accept | Add dev-mode warnings rather than hard failures so authoring feedback improves without breaking existing themes. | P30-I |
| 19 | Remove or use `ThemeSelectItem` | Accept | The current selector has a small dead-code split that should be cleaned up. | P30-I |
| 20 | Add visual regression snapshots | Expand | Do this as a phased browser QA rollout, not as an immediate full 23-theme matrix. | P30-J |

---

## Locked Delivery Tracks

### P30-H — Theme Catalog Unification & Selector Alignment

This is the catalog/source-of-truth track.

- Create one packaged JSON catalog under the plugin tree outside `assets/`.
- Add thin TypeScript and PHP loaders over that same file.
- Align the React selector and WordPress settings selector to the same grouping,
  ordering, names, descriptions, and seasonal metadata.
- Replace the current generic descriptions and weak swatch model with
  metadata-backed selector output.

### P30-I — Theme Runtime Hardening & Validation

This is the correctness and guardrail track.

- Fix Shadow DOM style element creation and cleanup in `ThemeContext.tsx`.
- Add explicit shadow-root cleanup coverage in `ThemeContext.test.tsx`.
- Harden runtime custom-theme registration against nullable or malformed
  extension values.
- Remove the selector dead-code split and stale runtime comments.
- Add build-time schema checks and dev-mode contrast warnings.

### P30-J — Theme QA & Visual Regression

This is the browser QA and snapshot track.

- Add focused browser coverage for theme preview, persistence, and WordPress
  precedence.
- Implement the locked visual regression scopes below.
- Update `docs/testing/THEME_QA_GUIDE.md` and
  `docs/testing/TESTING_QUICKSTART.md` so the documented workflow matches the
  actual theme QA plan.

---

## Locked Visual Snapshot Scope

### Phase 1

Phase 1 is intentionally minimal and low-flake.

- Environment: Chromium only, desktop only, shadow-DOM-only mount, mocked
  network harness, animations disabled.
- Themes: `default-dark`, `default-light`, `material-dark`, `high-contrast`,
  `tokyo-night`, `cyberpunk`.
- Per-theme surfaces:
  - gallery shell (header + campaign cards grid)
  - Display Settings dialog
- Additional selector baselines:
  - theme dropdown open in `default-dark`
  - theme dropdown open in `default-light`

Locked Phase 1 total: **14 snapshots**.

### Phase 2

Phase 2 expands coverage only after Phase 1 proves stable.

- Keep all Phase 1 environment constraints unchanged.
- Add themes: `material-light`, `nord`, `solarized-dark`,
  `catppuccin-mocha`, `ocean-breeze`, `sunset-boulevard`.
- Add one new surface: Admin Panel Campaigns view/table.

Locked Phase 2 total: **38 snapshots**.

### Explicitly Deferred

- Sign-in dialog snapshots
- Non-shadow snapshots
- Mobile and tablet snapshot projects
- Full 23-theme matrix

Those can be reconsidered only if the phased matrix proves stable and there is a
clear regression-catching benefit.

---

## Summary Recommendation

1. Start with catalog unification, not UI garnish. The core problem is drift
   between React, WordPress settings, and docs.
2. Land runtime hardening before any advanced theme UX. The Shadow DOM cleanup,
   selector cleanup, schema validation, and contrast warnings are phase-ready.
3. Use phased browser QA rather than jumping to a full snapshot matrix. The
   locked Phase 1 and Phase 2 scopes are the correct initial commitment.

The theme system should move forward as a focused Phase 30 lane:
`P30-H → P30-I → P30-J`.
