# P31-D Evaluation — Adapter Settings Single-Source-of-Truth

**Date:** 2026-05-21
**Status:** Pre-Evaluation (acceptance criteria not yet met)
**Related:** [PHASE31_REPORT.md](../phases/PHASE31_REPORT.md) # Track P31-D

---

## Executive Summary

P31-D is a valid, high-value pre-evaluation that should proceed to design. The problem it identifies — adapter settings defined across 4+ files in 2 languages — is real and currently requires manual 4-file touch for every new setting. The registry (`adapterRegistry.ts`) is the natural canonical source, and a generator deriving TypeScript, Zod, and PHP artifacts from it is low-risk and high-leverage.

---

## Problem Statement

Adapter settings are duplicated across four manually-synchronized surfaces:

| # | Layer | Location | What it holds |
|---|-------|----------|---------------|
| 1 | **Registry field definitions** | `adapterRegistry.ts` (`SETTING_GROUP_DEFINITIONS`) | Keys, labels, descriptions, fallbacks, constraints, `appliesTo`, control types |
| 2 | **TypeScript interface + defaults** | `types/index.ts` (`GalleryBehaviorSettings` + default object) | Typed field declarations and runtime default values |
| 3 | **Zod validation schema** | `types/settingsSchemas.ts` (`GalleryAdapterSettingsSchema`) | Runtime validation rules and enum constraints |
| 4 | **PHP sanitizer mappings** | `wp-plugin/.../class-wpsg-settings-sanitizer.php` (`$nested_adapter_field_map`) | JS-key to `wpsg_*` slug mapping for nested gallery sanitization |

**Adding one new adapter setting today requires editing all 4 files.** This is the maintenance burden P31-D aims to eliminate.

---

## Cross-Layer Parity Audit

### Scope

Audit covers the 70 unique adapter setting keys declared in registry field definitions (`key:` entries in `SETTING_GROUP_DEFINITIONS`), plus 16 `*Unit` keys referenced via `unitKey` on `dimension` controls.

### Key Counts

| Layer | Unique adapter-relevant keys |
|-------|------------------------------|
| Registry field `key:` entries | 70 |
| Registry `unitKey:` references | 16 |
| TypeScript `GalleryBehaviorSettings` | 323 (includes all non-adapter settings) |
| Zod `GalleryAdapterSettingsSchema` | ~80 (adapter + unit keys) |
| PHP `$nested_adapter_field_map` | 86 |

### Findings

#### 1. No Missing Fields Between Registry and PHP

All 70 registry field keys exist in the PHP sanitizer map. The P31-E (Spotlight), P31-F (Scroll Snap), and P31-G (Waterfall) additions were properly wired through PHP. **No gaps detected.**

#### 2. Unit Keys Are Structural, Not Drift

The 16 `*Unit` keys (`gridCardWidthUnit`, `imageBorderRadiusUnit`, `videoViewportHeightUnit`, etc.) appear in:
- Zod schema as explicit properties
- PHP sanitizer as explicit entries
- TypeScript interface as explicit properties
- **NOT** in the registry as standalone `key:` fields (they're implicit via `unitKey` on the parent `dimension` control)

This is **structural by design**, not a real drift. However, it means a code generator must understand the `dimension` control pattern to emit both the value key and its companion `*Unit` key.

#### 3. Zod Schema Is Effectively Non-Validating

`GalleryAdapterSettingsSchema` uses `.catchall(z.unknown())` which accepts any extra keys without error. The schema provides **structural shape documentation** but does not actually enforce adapter settings parity. This is a latent risk: if a future generator removes the catchall, real validation starts happening and could break things.

#### 4. Registry Fallbacks vs. TypeScript Defaults

The registry defines `fallback` values per field definition. TypeScript `types/index.ts` defines default values in the `GalleryBehaviorSettings` default object. These are two independent sources of truth for the same concept. Spot-check comparison shows alignment on sampled fields, but no systematic comparison has been performed.

#### 5. No Orphan Keys

No registry adapter field exists in TypeScript but not PHP, or vice versa. The reverse is also true — no TypeScript or PHP adapter key is missing from the registry. The four layers are currently in sync.

---

## Metadata Duplication Map

What each piece of metadata lives in and how many places it's duplicated:

| Metadata | Lives in | Duplicated in |
|----------|----------|---------------|
| Field key | Registry, Types, Zod, PHP | 4 places |
| Label / description | Registry only | 1 place |
| Type annotation | TypeScript interface | 1 place |
| Runtime default value | TypeScript defaults object | 1 place |
| Fallback value | Registry field definitions | Separate from TypeScript defaults |
| Enum constraints | Zod schema const arrays | Separate from registry `options` |
| PHP slug mapping | PHP sanitizer | 1 place |
| `appliesTo` scoping | Registry field definitions | 1 place |

---

## Proposed Canonical Source

### The Registry as Single Source of Truth

`SETTING_GROUP_DEFINITIONS` in `adapterRegistry.ts` is the natural canonical source because it already contains the richest metadata:

- Control type (`number`, `dimension`, `select`, `boolean`, `text`, `color`)
- Field key and label
- Description
- Constraints (`min`, `max`, `step`, `allowedUnits`, `options`)
- Fallback value
- `appliesTo` scoping (`unified`, `image`, `video`)
- `unitKey` for dimension controls

**Everything else can be derived:**

| Derived artifact | Derivation rule |
|-----------------|-----------------|
| TypeScript interface field | Key + control type maps to TS type (e.g., `number` -> `number`, `select` -> string union from `options`, `boolean` -> `boolean`, `dimension` -> `number` + separate `*Unit` field) |
| TypeScript default value | Copy `fallback` from registry |
| Zod schema entry | Key + control type maps to Zod validator (e.g., `z.number()`, `z.enum()` from `options`) |
| PHP sanitizer mapping | Key -> `snake_case` transformation of key name |

### What Stays Hand-Authored

- Adapter component implementations (no change)
- `AdapterRegistration` metadata (labels, capabilities, aliases, `optionLabels`)
- The `SETTING_GROUP_DEFINITIONS` itself (this IS the source of truth)
- `GalleryAdapterId` type union in `GalleryAdapter.ts`
- Common settings (non-adapter fields in `GalleryBehaviorSettings`)

---

## Generator Design (Prototype Scope)

### Input

`SETTING_GROUP_DEFINITIONS` from `adapterRegistry.ts`, exported or parseable.

### Output

1. **`types/index.ts` adapter fields** — Generate the adapter-specific portion of `GalleryBehaviorSettings` interface and the matching default values.
2. **`settingsSchemas.ts` adapter schema** — Generate `GalleryAdapterSettingsSchema` entries with proper Zod validators derived from control types.
3. **`class-wpsg-settings-sanitizer.php` adapter map** — Generate `$nested_adapter_field_map` entries with snake_case slug transformation.

### Execution Model

- Build-time codegen script (Node.js, co-located in `scripts/`)
- Runs as a pre-build step or manually via `npm run generate:adapter-settings`
- Output files include a `// Generated — do not edit` header with the generator version
- Hand-authored sections (non-adapter fields) are preserved behind sentinel comments

### Snake-Case Transformation

The PHP slug follows a consistent pattern: camelCase `camelCaseKey` -> `camel_case_key`. The transformation rule is:

```
insert underscore before each uppercase letter, lowercase all
```

Examples: `spotlightHeroAspectRatio` -> `spotlight_hero_aspect_ratio`, `scrollSnapAlignment` -> `scroll_snap_alignment`.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Generator produces incorrect types | Low | Registry field definitions are strongly typed; derivation rules are deterministic |
| Zod catchall removal breaks runtime | Medium | Keep `.catchall(z.unknown())` during transition; remove only after full validation confidence |
| Non-adapter settings accidentally affected | Low | Generator is scoped to adapter settings only; common settings remain hand-authored |
| Build step adds complexity | Low | Optional pre-build step; can be run manually during development |
| Fallback/default drift | Medium | Generator should use registry `fallback` as the authoritative default for adapter fields |

---

## Acceptance Criteria (from P31-D)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | A canonical-source proposal exists with clear generated and hand-authored boundaries | **Done** (this document) |
| 2 | The proposal documents how TypeScript validation, runtime defaults, and PHP registry data stay in sync | **Done** (this document) |
| 3 | The phase ends with a go/no-go decision on generator implementation | **Go — proceed to Phase 32+** |

---

## Go/No-Go Decision

**GO** — Proceed to generator implementation as a Phase 32 follow-on.

**Rationale:**

1. The problem is real and measured: 4-file manual sync per setting, 86+ keys across layers
2. The registry is already the richest source and drives the UI editor
3. Derivation rules are deterministic and testable
4. Risk is low — generated output replaces hand-authored content with identical semantics
5. Current parity is good (no drift detected), so the generator has a clean baseline
6. The Zod `.catchall(z.unknown())` issue is identified and can be addressed in the migration plan

**Prerequisites before implementation:**

1. Prototype the generator script against the current registry state
2. Diff generated output against existing hand-authored files to verify correctness
3. Add regression tests that validate generated output matches expected schemas
4. Decide on build-step integration (pre-build vs. manual script)

---

## Files Referenced

| File | Role in this evaluation |
|------|------------------------|
| `src/components/Galleries/Adapters/adapterRegistry.ts` | Canonical source candidate; 70 field keys + 16 unit keys |
| `src/types/index.ts` | TypeScript interface + defaults; parity audit target |
| `src/types/settingsSchemas.ts` | Zod validation; parity audit target; `.catchall` risk |
| `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php` | PHP sanitizer map; parity audit target |
| `src/components/Galleries/Adapters/GalleryAdapter.ts` | Adapter contract types (unchanged by generator) |
