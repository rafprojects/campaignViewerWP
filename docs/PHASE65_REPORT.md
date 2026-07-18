# Phase 65 - Campaign Import/Export Consolidation

**Status:** In progress (P65-A code complete, validating)
**Created:** 2026-07-14
**Last updated:** 2026-07-17

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P65-A | Extract `WPSG_Campaign_IO` service — consolidates 4 drifting import/export copies; fixes the layout-template (A-4), MD5-dedup, datetime, media-source (G-4), `attachmentId` and ZIP-streaming (E-4) drift by construction | Code complete (validating) | Medium-Large |
| P65-B | Campaign-filtered media-library export exports nothing (`attachmentId` through `intval($item['id'])`) + stream the standalone media-library ZIP import (E-4's 5th path) | Planned | Small |
| P65-C | Silent truncation caps on binary exports (audit log + media library) | Planned | Small |
| P65-D | Preserve media `type` (and `embedUrl`/`provider`) through export→import so videos/embeds survive a round-trip (currently forced to `image`) | Planned | Small-Medium |

> **2026-07-17 refinement.** Before execution, all six findings were independently re-verified against current source (three Explore agents + first-hand reads). The two smaller tracks (B, C) checked out exactly. Track A had two imprecise premises that changed the fix, plus one new bug and one new gap — all folded in below. See **Validation & Refinement (2026-07-17)** and the per-track notes.

---

## Rationale

The review ([PHP_REVIEW_FINDINGS.md](PHP_REVIEW_FINDINGS.md)) found the campaign import/export pipeline implemented four separate times (REST JSON, REST ZIP, CLI JSON, CLI ZIP), with real, already-diverged bugs as a direct consequence — plus two independent, narrower export bugs in the same files. All items were independently re-verified against current source on 2026-07-14, including the most concretely falsifiable claim (a CPT post-type slug mismatch), which checked out exactly as described.

1. **What triggered it.** C-1 is the single biggest duplicate-code item in the review (~350 duplicated lines across 4 functions), and it isn't hypothetical maintenance risk — the duplication has already produced two live bugs (A-4's layout-template loss, the MD5-dedup asymmetry between REST-ZIP and CLI-ZIP import) and one inconsistency (G-4's `source => 'url'` silently coerced to `'wp'`).
2. **Why it belongs together.** A-4, E-4 (streamed ZIP reads), and G-4 (media-source allowlist drift) are explicitly absorbed by C-1's consolidation — fixing them independently first would mean re-fixing them a second time once the service lands. A-5 and A-12 are independent bugs in the same controller files, cheap to fix in the same pass.
3. **Success.** One `WPSG_Campaign_IO` service backs REST JSON, REST ZIP, CLI JSON, and CLI ZIP; a JSON export/import round-trips the layout template correctly; a campaign-filtered media export actually returns that campaign's media; large exports either return everything or say plainly that they didn't.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Consolidation shape | One `WPSG_Campaign_IO` service exposing `build_entry(int $post_id, bool $binary)` and `import_entry(array $entry, ?ZipArchive $zip, array $opts)`; REST controllers and CLI become thin transport wrappers (HTTP status shaping / `WP_CLI::error` respectively). It is a **standalone** class (not a `WPSG_REST_Base` subclass) because `WPSG_CLI` does not extend the REST hierarchy; three `WPSG_REST_Base` helpers (`format_campaign`, `find_attachment_by_md5`, `clear_accessible_campaigns_cache`) were widened `protected`→`public` so the service can compose them. |
| B | MD5 dedup asymmetry resolution | Adopt the REST-ZIP behavior (dedupe imported media by MD5) as the canonical behavior for both REST and CLI ZIP import, since it's already correct there — not a new design, just applying the existing better implementation uniformly. |
| C | Canonical media `source` value set | **Revised 2026-07-17.** Original premise (all four imports write `'url'`) was wrong: only the two **JSON** paths did; both ZIP paths already correctly wrote `'upload'`. Resolution: JSON (URL-only, no attachment) imports write **`'external'`** — the value the app already fully supports for URL-referenced media (`class-wpsg-media-controller.php:406-419`), which the frontend renders and labels correctly (it treats any non-`'external'` source as an uploaded attachment, so the old `'url'` was mislabeled "Upload"). Also align the `create_media` route enum (`['upload','external','library']`) to the sanitizer allowlist (`['upload','library','wp','external','oembed']`). No new allowlist value invented. |
| D | Media `type` preservation (new track P65-D) | The pipeline hardcodes every re-imported media item to `type:'image'` (a pre-existing bug, not one of the 39 findings). Cleanly preserving `type` also requires carrying `embedUrl`/`provider` through the manifest (external videos need them to render), which is a schema change beyond A's scope. **Decision (user, 2026-07-17):** keep A focused, but track the fix explicitly as **P65-D** in this phase rather than a vague follow-on. |
| E | Sideloaded media `id`/`attachmentId` shape (new) | ZIP import wrote the attachment ID into the `id` field and never set `attachmentId`, so imported attachments were invisible to `wp wpsg media orphans` and metadata enrichment (both gate on `attachmentId`). Resolution: match the canonical upload shape — `id` = the source manifest's uniqid (preserved, so layout-slot bindings still resolve) with a UUID fallback, `attachmentId` = the WP post ID. **Decision (user, 2026-07-17):** fix inside P65-A since the same code is being rewritten. |

## Execution Priority

1. **P65-A** — do first; it's the largest track and its landing removes A-4, E-4 (campaign paths), and G-4 as separate work items (see Rationale). **Landed 2026-07-17** (branch `feat/phase65-php-hardening-3-of-5`).
2. **P65-B + P65-C (media-library half)** — both live in `class-wpsg-media-controller.php`; batch together. Zero file overlap with P65-A, so this batch can run in parallel. P65-B now also closes E-4's 5th path (`import_media_library_binary`, outside the campaign service) by reusing P65-A's streaming helper. P65-C's audit-log half is a separate file (`class-wpsg-campaign-controller.php`) and can drop in anytime.
3. **P65-D** — new track; do after A (it depends on A's rewritten pipeline being in place, and extends the manifest shape).

---

## Validation & Refinement (2026-07-17)

Before execution, every finding was re-verified against current source. Corrections folded in:

| # | Original claim | Verified reality | Effect |
|---|----------------|------------------|--------|
| 1 | A-4 affects "the pipeline" broadly | Isolated to the REST-JSON path only — `export_campaign()` (`class-wpsg-export-controller.php:94`) and `import_campaign()` (`:193-197`). REST-ZIP and both CLI paths already used `WPSG_Layout_Templates::get()/create()`. | Smaller, localized fix; still lands inside the C-1 extraction. |
| 2 | All 4 imports write `source => 'url'`, coerced to `'wp'` | Only the 2 **JSON** paths wrote `'url'`; both ZIP paths already wrote `'upload'`. (The coercion is real — the registered `media_items` sanitizer *does* run on `update_post_meta` once the CPT is registered on `init`, so `'url'` → `'wp'` in production.) | JSON paths now write **`'external'`** (Key Decision C). |
| 3 (new) | — | No import path set `attachmentId` on sideloaded media (only `id`), so imported attachments were invisible to `wp wpsg media orphans` and enrichment. | Fixed in P65-A (Key Decision E). |
| 4 (new) | E-4 "folds into C-1" | E-4's primary subject `import_media_library_binary()` is a **5th, standalone** ZIP path the campaign service can't reach. | Streaming fix moved to **P65-B** so E-4 closes fully (Phase 67's backlog already assumes this). |
| 5 | P65-A effort: Medium | ~829 lines / 8 functions / 5 entangled behavioral decisions; near-zero existing coverage of the bugs. | Re-labeled **Medium-Large**; new characterization tests are load-bearing, not optional. |

---

## Track P65-A - Extract `WPSG_Campaign_IO` service (absorbs A-4, E-4, G-4)

*Source: PHP_REVIEW_FINDINGS.md § C-1, A-4, E-4, G-4 — re-verified 2026-07-14, all sub-claims confirmed accurate, including the most concretely falsifiable one: the registered layout-template CPT slug is `wpsg_layout_tpl` (`includes/class-wpsg-layout-templates.php:109`), while JSON import creates posts of type `wpsg_layout_template` — a genuinely different, unregistered post type.*

### Problem

The campaign import pipeline (insert post → scalar meta map → gallery overrides → layout template → media refs/sideload → audit) is implemented **four times**: REST JSON `import_campaign()`, REST ZIP `import_single_campaign_from_zip()` (both `includes/rest/class-wpsg-export-controller.php`), CLI JSON `campaign_import()`, CLI ZIP `campaign_import_binary()` (both `includes/class-wpsg-cli.php`) — plus three near-identical export/manifest builders. The copies have already diverged into live bugs:

- **A-4 (layout template lost in JSON export/import):** Export does `get_post(intval($template_id))` — template IDs are UUID strings, so `intval()` always yields 0 and the exported `layout_template` is always null. Import creates a post of type `wpsg_layout_template` — **not** the actually-registered CPT `wpsg_layout_tpl` — writes meta in the wrong shape (`slots`/`background`/`graphic_layers` instead of the real single `_wpsg_template_data` blob), and binds the campaign to a numeric post ID even though real template lookup is by UUID `post_name`: an orphan post plus a dangling binding. The binary ZIP path and the WP-CLI JSON/ZIP paths already do this correctly via `WPSG_Layout_Templates::get()`/`::create()` — proof the REST JSON path was simply missed during the CPT migration.
- **MD5 dedup asymmetry:** REST ZIP import dedupes imported media via `find_attachment_by_md5()`; CLI ZIP import sideloads unconditionally with no dedup check — same archive, different outcome depending on which path imports it.
- **Datetime-handling asymmetry:** both REST paths normalize `publishAt`/`unpublishAt` via `strtotime()`; both CLI paths write them via plain `sanitize_text_field()` with no datetime branch at all.
- **E-4 (ZIP entries read fully into memory):** every ZIP-import code path uses `$zip->getFromName()` (full-entry read into memory) rather than `ZipArchive::getStream()` + `stream_copy_to_stream()` — a large video spikes PHP memory by its full size.
- **G-4 (media source-value drift):** all four import copies write `media_items[].source => 'url'`, which isn't in the registered meta-sanitizer allowlist (`upload|library|wp|external|oembed`) and is silently coerced to `'wp'` — accidental behavior that should be explicit. The REST `create_media` route's own enum (`upload|external|library`) is a third, different set from the sanitizer's.

### Fix

Per Key Decisions A–C: build one `WPSG_Campaign_IO` service exposing `build_manifest($post_id)` and `import_entry(array $entry, ?ZipArchive $zip)`. REST controllers (JSON + ZIP) and CLI commands (JSON + ZIP) become thin transport wrappers around it. Within the new service:
- Layout templates are always read/written via `WPSG_Layout_Templates::get()`/`::create()` (never `get_post(intval(...))` or a hand-rolled CPT insert).
- Media import always dedupes by MD5 (adopting the REST-ZIP behavior for both transports).
- Datetime fields are always normalized via `strtotime()` (adopting the REST behavior for both transports).
- ZIP entries are streamed (`getStream()`/`stream_copy_to_stream()`), not fully buffered.
- Media `source` is written as an explicit, real value from the sanitizer's canonical set — no more `'url'` placeholder relying on silent coercion.

### Acceptance criteria

- A campaign exported via JSON and re-imported via JSON round-trips its layout template correctly (same visual result as the binary/CLI paths already achieve).
- Importing the same ZIP archive via REST and via CLI produces identical results, including media dedup.
- Both REST and CLI JSON imports normalize schedule datetimes identically.
- A large (>500 MB equivalent) media entry in a ZIP import does not spike PHP memory by the entry's full size.
- `media_items[].source` written by any import path is a real, sanitizer-legal value — never silently rewritten to `'wp'` from `'url'`.
- All four transport call sites (REST JSON, REST ZIP, CLI JSON, CLI ZIP) are now thin wrappers with no duplicated pipeline logic.

### Validation

- Full existing import/export test suite (covering all four transports) stays green after the refactor.
- New JSON round-trip test asserting the layout template survives export→import.
- New test asserting REST-ZIP and CLI-ZIP produce identical dedup behavior on the same archive.
- Manual: export a campaign with a layout template via each of the four transports, re-import via each, confirm the template renders identically in all four cases.

### Implementation Notes (2026-07-17) — **LANDED**

**New service:** `includes/class-wpsg-campaign-io.php` (`WPSG_Campaign_IO`), a standalone class with two public statics:
- `build_entry(int $post_id, bool $binary): array` → `{ campaign, layout_template, media_references }` (binary adds `filename` per ref). Used by every export transport; the version envelope (v1/v2/v3) stays in the transport.
- `import_entry(array $entry, ?ZipArchive $zip, array $opts): array|WP_Error` → `{ id, title, media_imported, media_skipped[] }`. `$zip === null` ⇒ URL-only import (`source: 'external'`); `$zip` present ⇒ streamed sideload (`source: 'upload'`, `attachmentId` set, MD5 dedup). `$opts = { via: 'rest'|'cli', format: 'json'|'binary' }` shapes the single canonical audit entry.

**Behaviors unified (one correct implementation each):** layout template always via `WPSG_Layout_Templates::get()/create()` (A-4); MD5 dedup on every ZIP transport; datetime `strtotime()` normalization on every transport; `layoutBinding` recursively sanitized on every transport (was REST-only); media `source` = `'external'` (JSON) / `'upload'` (ZIP); `attachmentId` stamped on sideloaded media; ZIP entries streamed via a new `WPSG_Export_Engine::stream_zip_entry_to_file()` helper (E-4, campaign paths).

**Transports rewired to thin wrappers:** `export_campaign` / `import_campaign` / `export_campaign_binary` / `batch_export_binary` / `import_campaign_binary` (`class-wpsg-export-controller.php`); `campaign_export` / `campaign_import` / `campaign_import_binary` (`class-wpsg-cli.php`).

**Dead code removed:** `WPSG_Export_Controller::import_single_campaign_from_zip()` (~150 lines) and the CLI's private subset `format_campaign()`.

**Support change:** three `WPSG_REST_Base` helpers widened `protected`→`public` (`format_campaign`, `find_attachment_by_md5`, `clear_accessible_campaigns_cache`) so the standalone service can compose them — no behavior change (visibility only; no subclass redeclares them).

**Tests:** new `tests/WPSG_P65A_Campaign_IO_Test.php` (9 tests — build_entry A-4, source `external`/`upload`, `attachmentId`, datetime normalization, MD5 dedup, streaming helper, end-to-end round-trip). Tightened `WPSG_P39CM1_Export_Test::test_binary_import_round_trip` (real JPEG fixture; asserts 201 + `source:upload` + `attachmentId` instead of tolerating 500). Extended `WPSG_CLI_Test` (layout-template survives round-trip; new CLI ZIP-import test). Added real `import_campaign()` controller-path tests to `WPSG_Import_Sanitization_Test` (A-4 + G-4 regressions — the file previously only exercised `sanitize_template_data()` directly).

**Verification:** full PHPUnit suite green — **1213 tests, 13407 assertions, 0 failures, 0 errors, 2 pre-existing skips**. `php -l` + `phpcs -q` clean on all touched files. (Test execution delegated to a Haiku subagent via `/php-testing`; authored here.)

**Discovery worth noting:** the registered `media_items` meta sanitizer (`WPSG_CPT::sanitize_media_items`) *does* run on direct `update_post_meta` once the CPT is registered on `init` — so the old `source: 'url'` genuinely *was* being coerced to `'wp'` in production (an upload source with no attachment = broken). This confirms the `'external'` fix was necessary, not cosmetic. It also normalizes a missing `attachmentId` to `0`, which is why URL-only media carry `attachmentId: 0` rather than no key.

---

## Track P65-B - Media-library export/import fixes (A-5 + E-4's 5th path)

*Source: PHP_REVIEW_FINDINGS.md § A-5 — re-verified 2026-07-14, confirmed accurate. The codebase's own `WPSG_CLI::media_orphans()` already documents the correct rule inline: "Only use attachmentId (WP post ID); 'id' is a uniqid string and never matches attachment IDs" — this track applies that same rule to the export path that currently violates it.*

### Problem

`export_media_library_binary()` (`class-wpsg-media-controller.php:1592-1604`) restricts the export to a campaign by mapping `media_items[]['id']` through `intval()`. Media-item `id`s are UUIDs/uniqid strings, not the WP attachment ID — `intval()` yields 0 for all of them, the filtered attachment-ID list collapses to `[0]`, and the "campaign exists but has no media" empty-export branch triggers even for media-rich campaigns. The real WP attachment ID lives in `attachmentId`. The existing `WPSG_P48F_Media_Export_Test.php` test doesn't catch this because it exercises the filter with an empty `media_items` array rather than realistic UUID-id fixtures.

### Fix

- **B1 (A-5):** in `export_media_library_binary()`, map `intval($item['attachmentId'] ?? 0)` instead of `intval($item['id'])`.
- **B2 (E-4's 5th path):** in `import_media_library_binary()` (`class-wpsg-media-controller.php`, the standalone media-library ZIP import that `WPSG_Campaign_IO` structurally cannot reach), replace `$zip->getFromName('media/'.$filename)` with the streaming helper **`WPSG_Export_Engine::stream_zip_entry_to_file()`** built in P65-A. This closes E-4 completely (Phase 67's backlog assumes Phase 65 does so).

### Acceptance criteria

- A campaign-filtered media-library export of a campaign with real media items returns those items' files, not an empty archive.
- A large media-library ZIP import does not spike PHP memory by an entry's full size.

### Validation

- Extend `tests/WPSG_P48F_Media_Export_Test.php` with a realistic UUID-id media-items fixture (not an empty array) and assert the exported ZIP contains the expected files.
- Assert `import_media_library_binary()` still round-trips a real media entry after the streaming swap.

---

## Track P65-C - Silent truncation caps on binary exports

*Source: PHP_REVIEW_FINDINGS.md § A-12 — re-verified 2026-07-14, confirmed accurate. Verification found an additional detail: `WPSG_DB::list_audit_entries()` already computes and returns the true total row count, which the controller currently discards — the fix is cheaper than a full pagination loop for that path.*

### Problem

`export_audit_log_binary()` (`class-wpsg-campaign-controller.php`) fetches with `per_page => 5000, page => 1`; `export_media_library_binary()` (`class-wpsg-media-controller.php`) fetches with `posts_per_page => 500, paged => 1` — both single-page fetches, both silently drop everything beyond the cap with no `truncated` indicator anywhere in the manifest or response. Compliance-sensitive exports (the audit log especially) should never silently truncate.

### Fix

- For the audit log: `WPSG_DB::list_audit_entries()` already returns the true total; either loop pages until exhausted (the export engine's ZIP size limits already bound the archive), or surface `truncated: true` plus the true total in the manifest using the total the DB layer already computes.
- For the media library: loop `WP_Query` pages until exhausted, or surface the same `truncated`/total-count signal using `WP_Query::found_posts`.

### Acceptance criteria

- An audit log or media library with more entries than the current page cap either exports everything, or the manifest/response clearly states `truncated: true` and the true total count.
- An export within the cap is unaffected (no `truncated` flag, same output as today).

### Validation

- Test with a fixture exceeding the cap for both export types; assert either full export or an accurate `truncated`/total signal.

---

## Track P65-D - Preserve media `type` (and embed fields) through export→import

*New track, added 2026-07-17 (Key Decision D). Not one of the original 39 findings — surfaced during P65-A verification.*

### Problem

Every export/import path carries only `id`/`url`/`title` for each media item and the import side hardcodes `type => 'image'`. A campaign whose gallery contains videos or embeds loses that type on export→import: the re-imported items all become images. Now that P65-A routes all of this through one `WPSG_Campaign_IO::build_entry()` / `import_entry()`, the fix is a single-place change.

### Fix

- `build_entry()`: include `type` (and, for `external`/`oembed` items, `embedUrl` + `provider`) in each `media_reference`.
- `import_entry()`: honor the manifest's `type` (validated against `image|video|embed`) instead of hardcoding `image`; carry `embedUrl`/`provider` when present so external videos/embeds render. For JSON (URL-only) imports, `source` stays `'external'`; for ZIP imports (real attachment) it stays `'upload'`.
- Backward compatible: absent `type` still defaults to `image`; no manifest version bump needed (new optional fields).

### Acceptance criteria

- A campaign with a video/embed media item exported and re-imported (all four transports) keeps its `type` and renders as the same media kind.
- Existing image-only exports round-trip byte-for-byte identically.

### Validation

- Extend the `WPSG_Campaign_IO` test with a video/embed fixture; assert `type` and embed fields survive a build_entry→import_entry round-trip.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full pagination (rather than a truncation flag) for binary exports, if operators report needing exports beyond the current caps | Ships the correctness fix (no silent data loss) now; full looping can follow once real usage data shows the caps are actually hit in practice. |

## Implementation Notes

- **P65-A — landed 2026-07-17** on `feat/phase65-php-hardening-3-of-5`. See the "Implementation Notes (2026-07-17) — LANDED" block under Track P65-A for the full rationale, file list, decisions, and validation results (full suite: 1213 tests / 13407 assertions / 0 failures). Per-track commit; execution paused here for review before P65-B/C/D.
- **P65-B, P65-C, P65-D** — not started.

## Outcome

P65-A complete and validated (service extracted, all transports rewired to thin wrappers, A-4/MD5/datetime/G-4/attachmentId/E-4-campaign-paths fixed by construction, ~150 lines of duplicated import logic + a dead CLI helper removed, full suite green). P65-B/C/D pending.
