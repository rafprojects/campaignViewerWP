# Phase 11 — UX & Discovery Improvements

**Status:** In Progress  
**Version target:** v0.9.0  
**Created:** February 16, 2026
**Last updated:** February 16, 2026

---

## Overview

Phase 11 pulls forward the highest-priority and highest-impact tasks from `docs/FUTURE_TASKS.md`, with a focus on discoverability, first-impression UX, and campaign browsing quality.

This report also records the baseline inherited from Phase 10 so planning and implementation context stays in one place.

---

## Phase 10 Baseline (Carry-Forward)

- [x] Phase 10 completed and documented in `docs/PHASE10_REPORT.md`
- [x] Deferred items captured in `docs/FUTURE_TASKS.md` (A1/A2 stretch, E1/E2, Track F ideas)
- [x] Test baseline preserved (167 passing tests, 80% statement/line coverage threshold)
- [x] Project version bumped to v0.8.0 for the completed Phase 10 release

---

## Track A — High Priority UX (from FUTURE_TASKS)

### A1. Compact Sign-In Experience

**Problem:** Unauthenticated users currently see a large top-of-page sign-in form that competes with gallery content and pushes campaigns down.

- [x] Replace large inline sign-in surface with a compact trigger pattern (top inline prompt + modal)
- [x] Keep sign-in discoverable without obstructing gallery browsing
- [x] Preserve existing auth logic and signed-in `AuthBar`

**Effort:** Low–Medium  
**Impact:** High

### A2. Video Player Transparent Aspect Ratio

**Problem:** Non-16:9 media shows solid side fill for letterboxing/pillarboxing on some backgrounds.

- [x] Ensure transparent video container background for mixed aspect ratios
- [x] Standardize video gallery player height to avoid per-video layout jumps
- [x] Verify controls align with rendered video width (native `<video controls>` for uploaded videos)
- [~] Validate behavior for 16:9, 4:3, 1:1, and 9:16 (adaptive ratio logic implemented; full manual QA pending)

**Effort:** Low  
**Impact:** High

### A3. Campaign Card Thumbnails ✅

**Problem:** Campaign cards can show generic placeholder art instead of representative media.

- [x] Auto-select first media thumbnail when available
- [x] Add admin manual thumbnail override flow (existing or uploaded)
- [x] Keep placeholder fallback when no media thumbnail exists

**Effort:** Medium  
**Impact:** High

### A4. Offline / Network Failure Detection ✅

**Problem:** When connectivity drops, the UI can fail silently and confuse users.

- [x] Add online/offline status detection with visible offline banner
- [x] Fail fast for API requests while offline with user-friendly messaging
- [x] Recover gracefully on reconnect

**Effort:** Low–Medium  
**Impact:** Medium

---

## Track B — High-Impact Carryover (from FUTURE_TASKS)

### B1. Fix N+1 Media Fetch in CardGallery (E2 carryover)

- [ ] Introduce bulk media loading strategy (new endpoint or expanded campaign payload)
- [ ] Reduce initial request fan-out for large campaign sets

**Effort:** Medium (backend + frontend)  
**Impact:** High

### B2. Drag-and-Drop Media Reordering

- [ ] Replace manual up/down controls with drag-and-drop ordering
- [ ] Persist order changes reliably through existing media update APIs

**Effort:** Medium  
**Impact:** High

### B3. Bulk Media Operations

- [ ] Add multi-select for media in admin workflows
- [ ] Support batch delete/move actions with clear confirmations

**Effort:** Medium  
**Impact:** High

---

## Initial Implementation Order

1. A1 Compact Sign-In Experience
2. A2 Video Player Transparent Aspect Ratio
3. A3 Campaign Card Thumbnails
4. B1 N+1 Media Fetch
5. A4 Offline / Network Failure Detection
6. B2 Drag-and-drop Reordering
7. B3 Bulk Media Operations

---

## Progress Log

- **2026-02-16:** Phase 11 report created from FUTURE_TASKS high-priority/high-impact backlog. Phase 10 carry-forward baseline captured.
- **2026-02-16:** A1 completed — unauthenticated UX now uses a compact sign-in prompt with modal login (no gallery push-down), with existing auth flow unchanged.
- **2026-02-16:** A2 implemented — VideoCarousel now uses transparent player surfaces, robust autoplay URL handling, native uploaded-video playback with width-matched controls, and a standardized player height to prevent layout jumps across mixed-dimension videos.
- **2026-02-16 (QA):** Confirmed transparent rendering looks good for 9:16; additional ratio validation pending.
- **2026-02-16:** A3 completed — campaign cards auto-select representative media thumbnails; edit modal now supports manual thumbnail override (choose existing campaign media) and custom thumbnail upload.
- **2026-02-16:** A4 completed — added online/offline detection, persistent offline banner, API fail-fast behavior while offline, and reconnect-triggered campaign revalidation.

---

*Document created: February 16, 2026*
