# Phase 12 — Gallery Extensibility & Advanced Experience

**Status:** Planned  
**Version target:** v0.10.0 (planning target)  
**Created:** February 17, 2026
**Last updated:** February 17, 2026

---

## Overview

Phase 12 focuses on extensibility and advanced gallery UX. The goal is to promote high-impact architecture and UX work from `docs/FUTURE_TASKS.md` into a cohesive execution phase.

This phase centers on four promoted tracks:

1. Advanced video gallery controls/UX
2. Advanced image gallery controls/UX
3. Pluggable gallery implementation + layout builder foundation
4. Modularized embed provider handlers

---

## Track P12-A — Advanced Video Gallery

### Objectives

- Standardize viewport behavior across mixed-dimension videos (uploaded + external)
- Expose admin-configurable controls for advanced playback/gallery UX
- Preserve safe defaults and backwards compatibility for existing embeds

### Candidate Deliverables

- Gallery/player height controls
- Thumbnail strip scroll speed controls
- Scroll animation style/duration/easing controls
- Gallery card styling controls (radius, spacing, border/shadow presets)
- Enhanced scroll interactions (buttons, drag, wheel behavior)

**Effort:** Medium–High  
**Impact:** High

---

## Track P12-B — Advanced Image Gallery

### Objectives

- Bring image gallery control depth to parity with video gallery controls
- Improve consistency of admin customization across both media types

### Candidate Deliverables

- Gallery viewport height controls
- Thumbnail strip scroll speed controls
- Scroll animation style/duration/easing controls
- Gallery card styling controls (radius, spacing, border/shadow presets)
- Enhanced image gallery scroll controls

**Effort:** Medium–High  
**Impact:** High

---

## Track P12-C — Pluggable Gallery + Layout Builder (Epic Slice)

### Objectives

- Introduce a gallery adapter architecture for interchangeable gallery implementations
- Enable runtime gallery selection per media type
- Lay groundwork for manual layout authoring

### Proposed Phase 12 Scope Slice

1. Gallery adapter contract (capabilities + schema)
2. Runtime gallery selector setting (image/video)
3. At least one alternate implementation path (POC-level)
4. Persistence contract for layout presets (foundation)

### Deferred Beyond Phase 12 (Likely)

- Full manual canvas layout editor UX
- Rich migration tooling for multiple layout schema versions

**Effort:** High  
**Impact:** High

---

## Track P12-D — Modular Embed Provider Handlers

### Objectives

- Refactor provider-specific embed logic into modular handlers
- Improve maintainability and extensibility for current/future providers

### Candidate Deliverables

- Provider handler contract
- Registry/factory wiring for provider resolution
- Robust fallback thumbnail strategies for providers without reliable oEmbed
- Revisit non-oEmbed providers (including Rumble) for consistent preview behavior

**Effort:** Medium  
**Impact:** Medium

---

## Initial Execution Order

1. Track P12-D: Modular embed provider handlers (enables cleaner provider extensibility)
2. Track P12-C: Gallery adapter contract + runtime selector foundation
3. Track P12-A: Advanced video gallery controls
4. Track P12-B: Advanced image gallery controls

---

## Acceptance Criteria (Phase-Level)

- Advanced controls are configurable from admin and preserve current default behavior
- Gallery adapter contract supports at least default + one alternate implementation path
- Embed provider logic is modularized with explicit provider contracts
- Existing embeds remain backwards compatible with no breaking schema changes

---

## Risks & Mitigations

- **Scope creep risk (very high):** keep layout-builder as a phased epic with explicit Phase 12 slice
- **UX complexity risk:** ship safe defaults + progressive disclosure in admin settings
- **Backwards compatibility risk:** include migration guards and fallback behavior for missing config

---

## Progress Log

- **2026-02-17:** Phase 12 planning doc created and tracks promoted from `FUTURE_TASKS.md`.

---

*Document created: February 17, 2026*
