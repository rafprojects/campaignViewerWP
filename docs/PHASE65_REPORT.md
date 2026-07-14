# Phase 65 - Campaign Import/Export Consolidation

**Status:** Planned
**Created:** 2026-07-14
**Last updated:** 2026-07-14

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P65-A | Extract `WPSG_Campaign_IO` service — consolidates 4 drifting import/export copies; fixes the layout-template bug and media-source-value drift by construction | Planned | Medium |
| P65-B | Campaign-filtered media-library export exports nothing (UUID through `intval()`) | Planned | Tiny |
| P65-C | Silent truncation caps on binary exports (audit log + media library) | Planned | Small |

---

## Rationale

The review ([PHP_REVIEW_FINDINGS.md](PHP_REVIEW_FINDINGS.md)) found the campaign import/export pipeline implemented four separate times (REST JSON, REST ZIP, CLI JSON, CLI ZIP), with real, already-diverged bugs as a direct consequence — plus two independent, narrower export bugs in the same files. All items were independently re-verified against current source on 2026-07-14, including the most concretely falsifiable claim (a CPT post-type slug mismatch), which checked out exactly as described.

1. **What triggered it.** C-1 is the single biggest duplicate-code item in the review (~350 duplicated lines across 4 functions), and it isn't hypothetical maintenance risk — the duplication has already produced two live bugs (A-4's layout-template loss, the MD5-dedup asymmetry between REST-ZIP and CLI-ZIP import) and one inconsistency (G-4's `source => 'url'` silently coerced to `'wp'`).
2. **Why it belongs together.** A-4, E-4 (streamed ZIP reads), and G-4 (media-source allowlist drift) are explicitly absorbed by C-1's consolidation — fixing them independently first would mean re-fixing them a second time once the service lands. A-5 and A-12 are independent bugs in the same controller files, cheap to fix in the same pass.
3. **Success.** One `WPSG_Campaign_IO` service backs REST JSON, REST ZIP, CLI JSON, and CLI ZIP; a JSON export/import round-trips the layout template correctly; a campaign-filtered media export actually returns that campaign's media; large exports either return everything or say plainly that they didn't.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Consolidation shape | One `WPSG_Campaign_IO` (or similarly namespaced) service exposing `build_manifest($post_id)` and `import_entry(array $entry, ?ZipArchive $zip)`; REST controllers and CLI become thin transport wrappers (HTTP status shaping / `WP_CLI::error` respectively). |
| B | MD5 dedup asymmetry resolution | Adopt the REST-ZIP behavior (dedupe imported media by MD5) as the canonical behavior for both REST and CLI ZIP import, since it's already correct there — not a new design, just applying the existing better implementation uniformly. |
| C | Canonical media `source` value set | Adopt the meta sanitizer's allowlist (`upload\|library\|wp\|external\|oembed`) as canonical; update the REST `create_media` route enum to match, and make `WPSG_Campaign_IO`'s import builder write an explicit, real source value instead of the placeholder `'url'` that's been silently coerced to `'wp'`. |

## Execution Priority

1. **P65-A** — do first; it's the largest track and its landing removes A-4, E-4, and G-4 as separate work items (see Rationale).
2. **P65-B** — independent of P65-A; can proceed in parallel, but touches a neighboring file (`class-wpsg-media-controller.php`) so coordinate to avoid merge conflicts if both are in flight.
3. **P65-C** — independent; do last since it's the lowest-risk, most mechanical fix (pagination loop / truncation flag, no new abstractions).

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

---

## Track P65-B - Campaign-filtered media-library export exports nothing

*Source: PHP_REVIEW_FINDINGS.md § A-5 — re-verified 2026-07-14, confirmed accurate. The codebase's own `WPSG_CLI::media_orphans()` already documents the correct rule inline: "Only use attachmentId (WP post ID); 'id' is a uniqid string and never matches attachment IDs" — this track applies that same rule to the export path that currently violates it.*

### Problem

`export_media_library_binary()` (`class-wpsg-media-controller.php:1592-1604`) restricts the export to a campaign by mapping `media_items[]['id']` through `intval()`. Media-item `id`s are UUIDs/uniqid strings, not the WP attachment ID — `intval()` yields 0 for all of them, the filtered attachment-ID list collapses to `[0]`, and the "campaign exists but has no media" empty-export branch triggers even for media-rich campaigns. The real WP attachment ID lives in `attachmentId`. The existing `WPSG_P48F_Media_Export_Test.php` test doesn't catch this because it exercises the filter with an empty `media_items` array rather than realistic UUID-id fixtures.

### Fix

Map `intval($item['attachmentId'] ?? 0)` instead of `intval($item['id'])`.

### Acceptance criteria

- A campaign-filtered media-library export of a campaign with real media items returns those items' files, not an empty archive.

### Validation

- Extend `tests/WPSG_P48F_Media_Export_Test.php` with a realistic UUID-id media-items fixture (not an empty array) and assert the exported ZIP contains the expected files.

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

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full pagination (rather than a truncation flag) for binary exports, if operators report needing exports beyond the current caps | Ships the correctness fix (no silent data loss) now; full looping can follow once real usage data shows the caps are actually hit in practice. |

## Implementation Notes

- Record completed work here as tracks land; nothing executed yet.

## Outcome

Not started.
