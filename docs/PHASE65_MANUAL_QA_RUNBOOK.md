# Phase 65 — Manual QA & Validation Runbook

**Companion to:** [PHASE65_REPORT.md](PHASE65_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand — exact preconditions, commands, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test. It follows the format of [PHASE64_MANUAL_QA_RUNBOOK.md](PHASE64_MANUAL_QA_RUNBOOK.md).

**Scope:** tracks P65-A … P65-D, plus §5's two post-landing PR-review fixes. Phase 65 is almost entirely a **backend** change (the campaign/media import-export pipeline). There is no new frontend surface; you verify it through the REST API and WP-CLI, then inspect the resulting post meta / manifests. Do the shared setup once (§1–§3), then run the tracks in any order.

**Golden rule (unchanged from P63/P64):** a fix's test is only meaningful if you have also seen it **fail without the fix**, or you understand precisely why the pre-fix code was wrong. Each section states the pre-fix behavior so a green result actually proves something. The cleanest way to watch these particular fixes fail is to check out the commit **before** this phase and re-run the same steps:

```bash
git log --oneline | grep p65        # find the P65 commits
git checkout 24a0ae6a               # the commit just before P65-A (docs: archive phase 64)
# …run a step, observe the broken behavior…
git checkout feat/phase65-php-hardening-3-of-5   # back to the fixes
```

For §5's two fixes specifically: Fix 2 (batch export filename mismatch) pre-dates the whole phase, so `24a0ae6a` reproduces it too. Fix 1 (embedUrl/provider drop) was introduced by the P65-D commit itself — to see it fail, checkout `af8c4904` (P65-D landed, post-landing fixes not yet applied) instead of `24a0ae6a`.

**A note on the streaming fixes (E-4).** Two sub-items (P65-A's ZIP-import streaming, P65-B's media-library ZIP-import streaming) change *memory behavior*, not *functional output* — a correct round-trip looks identical before and after. For those, this runbook verifies the **functional round-trip still works** and offers an **optional** peak-memory measurement for anyone who wants to observe the actual win, rather than inventing a ritual that proves nothing.

---

## 1. Environment

| Requirement | Why |
|---|---|
| Local `wp-env` dev site (`npx wp-env start` from repo root) | Standard test host. Base URL `http://localhost:8888`. |
| `curl` (`-s`/`-i`), `jq`, `unzip` | REST + manifest assertions are scriptable and unambiguous. |
| WP-CLI via `npx wp-env run cli wp …` | CLI is one of the four transports under test (and was the source of two of the fixed bugs). |
| Two small media files (a JPEG **and** an MP4) reachable inside the container, e.g. dropped in the plugin's `tests/stubs/` | P65-A/B exercise real sideloads; P65-D needs a *video* item to prove type survives. |
| System Admin auth for curl (Application Password) | The export/import endpoints are admin-gated; the media-library and audit exports are **System-Admin-tier**. |

```bash
export BASE=http://localhost:8888
export AUTH='-u sysadmin:APP_PASSWORD'     # an Application Password for a System Admin
```

**Personas / auth.** Phase 65 uses the same RBAC model as Phase 63/64 — see **§2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md)** for how to create a System Admin and mint an Application Password. All commands below assume a System Admin unless stated.

**Running an async export job.** The binary exports (`…/export/binary`, `admin/media/export/binary`, `admin/audit-log/export/binary`) return `202 {jobId}` and process on WP-Cron. In manual QA, force the job to run rather than waiting:

```bash
npx wp-env run cli wp cron event run wpsg_export_process_job
```

Then poll `GET /export-jobs/{jobId}` until `status:"complete"` and download it.

---

## 2. Mental model — what actually changed

**The four campaign transports (plus a fifth media path).** The campaign import/export pipeline existed as four near-identical copies; P65-A replaced them with one service (`WPSG_Campaign_IO`) that all four now call:

| Transport | Export | Import |
|---|---|---|
| REST JSON | `GET /campaigns/{id}/export` | `POST /campaigns/import` (body = the export payload) |
| REST ZIP | `POST /campaigns/{id}/export/binary` → job | `POST /campaigns/import/binary` (multipart file) |
| CLI JSON | `wp wpsg campaign export {id}` | `wp wpsg campaign import file.json` |
| CLI ZIP | `wp wpsg campaign export {id} --format=binary` | `wp wpsg campaign import file.zip` |

The **fifth** path — `POST /admin/media/export/binary` / `POST /media/import/binary` — is the standalone *media-library* export/import (not a campaign), fixed in P65-B.

**The media-item shape (this is the crux of several fixes).** Each entry in a campaign's `media_items` post-meta looks like:

```jsonc
{
  "id": "a1b2c3…",        // a uniqid STRING — NOT the attachment ID
  "attachmentId": 4212,    // the WP attachment post ID (only for uploaded media)
  "type": "image",         // image | video | embed
  "source": "upload",      // upload | library | wp | external | oembed
  "url": "https://…",
  "embedUrl": "https://…", // external videos/embeds only
  "provider": "youtube"    // external videos/embeds only
}
```

Keep `id` vs `attachmentId` straight — conflating them is the root of A-5 and the missing-`attachmentId` bug.

**Inspecting state.** After any import, look at the new campaign's meta:

```bash
npx wp-env run cli wp post meta get <CID> media_items --format=json | jq .
npx wp-env run cli wp post meta get <CID> _wpsg_layout_binding_template_id
npx wp-env run cli wp post meta get <CID> publish_at
```

---

## 3. Reusable setup recipes

```bash
# A campaign to export from:
CID=$(npx wp-env run cli wp post create --post_type=wpsg_campaign \
  --post_title='P65 Source' --post_status=publish --porcelain)
npx wp-env run cli wp post meta update $CID status active
npx wp-env run cli wp post meta update $CID publish_at '2026-08-01 09:00:00'

# A layout template, bound to the campaign (needed for the A-4 tests):
TPL=$(curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/admin/layout-templates" \
  -H 'Content-Type: application/json' \
  -d '{"name":"P65 Template","canvasAspectRatio":1.0,"slots":[{"id":"s1","x":0,"y":0,"width":50,"height":50}]}' \
  | jq -r '.id')
npx wp-env run cli wp post meta update $CID _wpsg_layout_binding_template_id "$TPL"

# Add media to the campaign the realistic way — through the admin SPA Media tab
# (uploads create attachments and write media_items with a real attachmentId).
# Or, for a URL-only 'external' item + a video, set meta directly:
npx wp-env run cli wp eval '
  update_post_meta('"$CID"', "media_items", [
    ["id"=>"img-1","attachmentId"=>0,"type"=>"image","source"=>"external","url"=>"https://example.com/a.jpg","title"=>"An image"],
    ["id"=>"vid-1","type"=>"video","source"=>"external","url"=>"https://example.com/watch","embedUrl"=>"https://example.com/embed/1","provider"=>"youtube","title"=>"A video"],
  ]);'
```

---

## 4. Track-by-track

---

### P65-A — `WPSG_Campaign_IO` service (consolidation + A-4, dedup, datetime, G-4, attachmentId, E-4)

**What & why.** The four transports above were four copies that had drifted into real bugs. P65-A makes them thin wrappers over one service, so each concern has exactly one implementation. Verify the concerns individually (Parts 1–5), then prove they're now uniform across transports (Part 6). Part 7 is the streaming (E-4) note.

#### Part 1 — A-4: the layout template survives a JSON round-trip

Pre-fix, the REST-JSON path exported the template via `get_post(intval($uuid))` — `intval` of a UUID is 0, so the export always carried `layout_template: null`; import then created a post of the **unregistered** `wpsg_layout_template` type and bound a numeric ID the template library never sees.

```bash
# Export the source campaign (which has $TPL bound) as JSON and re-import it:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/export" -o /tmp/camp.json
jq '.layout_template' /tmp/camp.json           # ← must NOT be null; a template object with id+name

NEWID=$(curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/import" \
  -H 'Content-Type: application/json' --data @/tmp/camp.json | jq -r '.id')

# The imported campaign is bound to a template resolvable through the CRUD class:
BOUND=$(npx wp-env run cli wp post meta get $NEWID _wpsg_layout_binding_template_id)
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/admin/layout-templates/$BOUND" | jq '{id,name}'
# → the template (name "P65 Template"), i.e. it lives under the real CPT wpsg_layout_tpl

# And no orphan of the wrong post type was ever created. (Query by SQL — the type
# is unregistered, so `wp post list --post_type=wpsg_layout_template` would error
# rather than return 0.)
npx wp-env run cli wp db query "SELECT COUNT(*) FROM wp_posts WHERE post_type='wpsg_layout_template'"   # → 0
```

**Expected (pass).** `layout_template` in the export is a real object (not `null`); the re-imported campaign's binding resolves via `GET /admin/layout-templates/{uuid}`; zero `wpsg_layout_template` posts exist.

**Why it proves the fix.** Pre-fix, `jq '.layout_template'` prints `null` and the `wpsg_layout_template` count is ≥1 (orphans). A resolvable binding + zero orphans is only possible once export uses `WPSG_Layout_Templates::get()` and import uses `::create()`.

#### Part 2 — G-4: URL-only media import is `source:"external"` (not `"url"`)

Pre-fix, JSON import wrote `source:"url"` — not a registered value; the `media_items` meta sanitizer coerces it to `"wp"` (an *upload* source with no attachment), and the admin Media tab mislabels it "Upload".

```bash
npx wp-env run cli wp post meta get $NEWID media_items --format=json \
  | jq '.[] | {id, source, attachmentId}'
```

**Expected (pass).** Each URL-referenced item shows `"source":"external"` and `attachmentId` **0** (no real attachment). Pre-fix it would show `"source":"wp"` (coerced from `"url"`) — a broken upload-with-no-file.

#### Part 3 — datetime normalization is uniform (the CLI path is the tell)

Pre-fix, both **REST** paths normalized `publishAt`/`unpublishAt` via `strtotime()`, but both **CLI** paths stored the raw string. Feed the CLI a non-canonical datetime and confirm it's now normalized like REST:

```bash
# Craft a JSON export whose publishAt is ISO-8601 with a timezone, then CLI-import it:
npx wp-env run cli sh -c '
  cd /var/www/html/wp-content/plugins/wp-super-gallery &&
  echo "{\"version\":1,\"campaign\":{\"title\":\"DT Test\",\"publishAt\":\"2026-08-01T12:30:00+00:00\"},\"media_references\":[]}" > /tmp/dt.json &&
  wp wpsg campaign import /tmp/dt.json'
# Grab the new ID from the success line, then:
npx wp-env run cli wp post meta get <NEW_DT_ID> publish_at
# → 2026-08-01 12:30:00   (normalized Y-m-d H:i:s, NOT the raw ISO string)
```

**Expected (pass).** `publish_at` is stored as `2026-08-01 12:30:00`. Pre-fix, the CLI stored the raw `2026-08-01T12:30:00+00:00`.

#### Part 4 — MD5 dedup is uniform (the CLI ZIP path is the tell)

Pre-fix, REST-ZIP import deduped identical media by MD5; **CLI-ZIP import did not** — the same archive produced duplicate attachments via CLI. Build a ZIP whose manifest references the *same bytes* under two filenames and import it via CLI:

```bash
npx wp-env run cli sh -c '
  cd /var/www/html/wp-content/plugins/wp-super-gallery &&
  php -r "
    \$z=new ZipArchive; \$z->open(\"/tmp/dedup.zip\",ZipArchive::CREATE|ZipArchive::OVERWRITE);
    \$m=[\"version\"=>2,\"campaign\"=>[\"title\"=>\"Dedup\"],\"layout_template\"=>null,
      \"media_references\"=>[
        [\"id\"=>\"d1\",\"title\"=>\"one\",\"filename\"=>\"media-d1.jpg\"],
        [\"id\"=>\"d2\",\"title\"=>\"two\",\"filename\"=>\"media-d2.jpg\"]]];
    \$z->addFromString(\"manifest.json\",json_encode(\$m));
    \$bytes=file_get_contents(\"tests/stubs/1x1.jpg\");
    \$z->addFromString(\"media/media-d1.jpg\",\$bytes);
    \$z->addFromString(\"media/media-d2.jpg\",\$bytes);
    \$z->close();" &&
  wp wpsg campaign import /tmp/dedup.zip'
# Inspect the two media items — both must point at the SAME attachment:
npx wp-env run cli wp post meta get <NEW_DEDUP_ID> media_items --format=json \
  | jq '[.[].attachmentId]'
# → [4212, 4212]  (identical) — one attachment reused, not two created
```

**Expected (pass).** Both items carry the **same** `attachmentId`. Pre-fix (CLI), you'd get two different IDs (two attachments for identical bytes).

#### Part 5 — sideloaded media carry `attachmentId` (orphan detection + enrichment)

Pre-fix, ZIP import put the attachment ID into the `id` field and never set `attachmentId`. Because `wp wpsg media orphans` and metadata enrichment both key off `attachmentId`, every imported attachment looked *orphaned* and was skipped for dimensions/tags.

```bash
# Using the campaign imported in Part 4 (its media were sideloaded):
npx wp-env run cli wp post meta get <NEW_DEDUP_ID> media_items --format=json \
  | jq '.[0] | {id, attachmentId, source}'
# → id is a uniqid string, attachmentId is a positive int, source "upload"

# The imported attachment is NOT reported as an orphan:
npx wp-env run cli wp wpsg media orphans --format=ids
# → the sideloaded attachment ID does NOT appear
```

**Expected (pass).** `id` ≠ `attachmentId`; `attachmentId` is a positive int; the attachment is absent from `media orphans`. Pre-fix, `id` held the attachment ID, `attachmentId` was missing, and `media orphans` listed the attachment even though a campaign references it.

#### Part 6 — cross-transport parity (the whole point of the consolidation)

Export the **same** source campaign through all four transports and confirm identical results. The sharpest single check is the layout template + media source, which every transport now handles the same way:

```bash
# JSON (REST) — already done in Part 1.
# JSON (CLI):
npx wp-env run cli sh -c 'cd /var/www/html/wp-content/plugins/wp-super-gallery && wp wpsg campaign export '"$CID"' > /tmp/cli.json && wp wpsg campaign import /tmp/cli.json'
# Binary (CLI):
npx wp-env run cli sh -c 'cd /var/www/html/wp-content/plugins/wp-super-gallery && wp wpsg campaign export '"$CID"' --format=binary --output=/tmp/cli.zip && wp wpsg campaign import /tmp/cli.zip'
# Binary (REST): POST the ZIP built above to /campaigns/import/binary:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/import/binary" -F 'file=@/tmp/cli.zip' | jq '{id,title}'
```

For each resulting campaign, `wp post meta get <id> _wpsg_layout_binding_template_id` must resolve via the CRUD class, and its media `source` values must be the correct `external`/`upload` (never `url`/`wp`-from-`url`).

**Expected (pass).** All four imports produce a resolvable layout binding and correctly-typed media sources. **Why it proves the fix:** pre-fix, the REST-JSON path lost the template while the others kept it, and CLI vs REST diverged on dedup/datetime — parity across all four is the observable signature of "one service backs them all."

#### Part 7 — E-4: ZIP entries are streamed, not buffered (memory)

**Manual QA: functional round-trip + optional memory check.** Streaming changes memory use, not output — Parts 4–6 already prove the ZIP import round-trips correctly with the streaming reader. To *observe* the memory win, import a ZIP containing one large media file and compare peak memory before/after the fix:

```bash
# Build a ZIP with a ~200 MB dummy media file and import it, printing peak memory:
npx wp-env run cli sh -c '
  cd /var/www/html/wp-content/plugins/wp-super-gallery &&
  php -r "\$z=new ZipArchive;\$z->open(\"/tmp/big.zip\",ZipArchive::CREATE|ZipArchive::OVERWRITE);
    \$z->addFromString(\"manifest.json\",json_encode([\"version\"=>2,\"campaign\"=>[\"title\"=>\"Big\"],\"media_references\"=>[[\"id\"=>\"b1\",\"filename\"=>\"media-b1.bin\"]]]));
    \$z->addFromString(\"media/media-b1.bin\",str_repeat(\"x\",200*1024*1024));\$z->close();" &&
  wp wpsg campaign import /tmp/big.zip &&
  echo "peak: $(php -r "echo round(memory_get_peak_usage(true)/1048576).\"MB\";")"'
```

**Expected (pass, post-fix).** The import completes without a memory spike proportional to the file size. Pre-fix, `getFromName()` read the whole 200 MB entry into a PHP string first, so peak memory jumped by ~200 MB (and could OOM under a tight `memory_limit`). This is **informational** — the functional pass criterion is that Parts 4–6 round-trip correctly.

**Regression checks (whole track).** Full PHPUnit suite green — `WPSG_P65A_Campaign_IO_Test` (11 tests) plus the tightened `WPSG_P39CM1`, `WPSG_CLI_Test`, `WPSG_Import_Sanitization_Test`. `grep -rn "import_single_campaign_from_zip" includes/` returns **zero** hits (dead copy removed). `grep -rn "=> 'url'," includes/rest/class-wpsg-export-controller.php includes/class-wpsg-cli.php` returns **zero** (no more `'url'` source literal).

**Pitfalls.**
- The `media_items` sanitizer runs on `update_post_meta` once the CPT is registered, so it *adds* `attachmentId: 0` to URL-only items and would coerce a stray `source` to `"wp"`. That's why Part 2 asserts `external` (a legal value that survives) — asserting "no attachmentId key" would wrongly fail.
- CLI file I/O happens **inside the container**; keep the export and re-import in the same `wp-env run cli sh -c '…'` invocation (as shown) so `/tmp/*.json` and `/tmp/*.zip` are the same filesystem.
- Datetime round-trips still *pass* for the common case even pre-fix (an already-canonical `Y-m-d H:i:s` survives `sanitize_text_field`); Part 3 deliberately feeds a **non-canonical** ISO string so the normalization is observable.

---

### P65-B — media-library export/import fixes (A-5 + E-4's 5th path)

**What & why.** Two fixes in the standalone media-library path. **B1 (A-5):** `export_media_library_binary()` filtered a campaign's media by `intval($item['id'])` — but `id` is a uniqid string, so `intval` yielded 0 for every item, the filter collapsed to `[0]`, and a media-rich campaign exported an **empty** archive. Fixed to key off `attachmentId`. **B2 (E-4):** `import_media_library_binary()` now streams ZIP entries instead of buffering them.

**Preconditions.** A campaign whose `media_items` reference **real uploaded attachments** (`attachmentId` set). The easiest way: in the admin SPA → the campaign → Media tab → upload two images. Then `wp post meta get <CID> media_items --format=json` shows entries with positive `attachmentId`.

#### B1 — campaign-filtered media export returns the campaign's files

```bash
# Export the media library, filtered to the campaign:
JOB=$(curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/admin/media/export/binary" \
  -H 'Content-Type: application/json' -d "{\"campaign_id\":$CID}" | jq -r '.jobId')
npx wp-env run cli wp cron event run wpsg_export_process_job
# Poll to completion, then download and inspect the manifest:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB/download" -o /tmp/mlib.zip
unzip -p /tmp/mlib.zip manifest.json | jq '{item_count, total_available, truncated}'
unzip -l /tmp/mlib.zip | grep media/     # the actual files are present
```

**Expected (pass).** `item_count` equals the number of uploaded media in the campaign (≥1), and the ZIP contains `media/…` files. **Why it proves the fix:** pre-fix, `item_count` is **0** and the archive has no `media/` entries even though the campaign is media-rich — because the `id`-based filter zeroed out every attachment ID.

#### B2 — media-library ZIP import streams (functional round-trip)

Import a media-library ZIP (a real image entry) and confirm it lands:

```bash
# Reuse /tmp/mlib.zip from B1 (it is a valid media_library package):
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/media/import/binary" \
  -F 'file=@/tmp/mlib.zip' | jq '{imported: (.imported|length), skipped}'
```

**Expected (pass).** `imported ≥ 1`, `skipped` empty — the streamed entries sideload correctly. (Memory behavior mirrors P65-A Part 7; the optional big-file measurement applies here too, against `/media/import/binary`.)

**Regression checks.** `WPSG_P48F_Media_Export_Test` — the realistic campaign-filter export (real attachment, asserts the file is included) and the streamed import round-trip. An **unfiltered** media-library export (`no campaign_id`) still exports the whole library as before.

**Pitfalls.** If you build the campaign's media by hand-editing `media_items`, you must set a real `attachmentId` (a real uploaded attachment's post ID) — a made-up integer will "export" a manifest row but the file-collection step finds no attachment and the ZIP is empty, which looks like the bug. Upload through the Media tab to avoid this.

---

### P65-C — binary exports no longer silently truncate

**What & why.** `export_audit_log_binary()` fetched `per_page:5000, page:1` and `export_media_library_binary()` fetched `posts_per_page:500, paged:1` — both single-page, both dropping everything past the cap with no signal. Now both manifests carry `total_available` (the true count) and `truncated` (bool). The audit path reuses the true total `list_audit_entries()` already computes; the media path reads `WP_Query::found_posts`/`max_num_pages`.

#### Part 1 — audit-log export manifest reports total + truncation

```bash
JOB=$(curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/admin/audit-log/export/binary" | jq -r '.jobId')
npx wp-env run cli wp cron event run wpsg_export_process_job
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB/download" -o /tmp/audit.zip
unzip -p /tmp/audit.zip manifest.json | jq '{entry_count, total_available, truncated}'
```

**Expected (pass, within cap).** `total_available == entry_count` and `truncated == false`. **Why it proves the fix:** pre-fix, the manifest had **no** `total_available`/`truncated` keys at all (`jq` prints `null`). Their presence and accuracy is the fix.

#### Part 2 — media-library export manifest reports total + truncation

Reuse the B1 export (or run an unfiltered one) and check the same keys:

```bash
unzip -p /tmp/mlib.zip manifest.json | jq '{item_count, total_available, truncated}'
```

**Expected (pass, within cap).** `total_available` is the true match count and `truncated == false`.

**Observing `truncated: true`.** The caps are 5000 (audit) / 500 (media) — deliberately hard to exceed by hand. If you want to see the flag flip, temporarily lower the cap on a scratch checkout (edit `per_page`/`posts_per_page` to e.g. 2), seed 3+ rows, and re-export: `truncated` becomes `true` and `total_available` exceeds `entry_count`/`item_count`. This is the same logic (`total_available > count` for audit, `max_num_pages > 1` for media) the unit tests pin at the boundary.

**Regression checks.** `WPSG_P28G_Audit_Log_Test` (within-cap audit manifest) and `WPSG_P48F_Media_Export_Test` (within-cap media manifest). An export within the cap is otherwise byte-for-byte unchanged apart from the two new manifest keys.

**Pitfalls.** `total_available` for a **campaign-filtered** media export reflects the *filtered* match count (attachments referenced by that campaign), not the whole library — that's correct. Don't compare it against the full library size.

---

### P65-D — media `type` (and embed fields) survive a round-trip

**What & why.** Every transport carried only `id`/`url`/`title` per media item and import hardcoded `type:"image"` — so a campaign with a **video** or **embed** came back as an image after export→import. Now `build_entry()` carries `type` (plus `embedUrl`/`provider` for external media) and import honors it.

**Preconditions.** The source campaign from §3 includes a `vid-1` item with `type:"video"`, `embedUrl`, and `provider:"youtube"`.

```bash
# Confirm the export entry now carries type + embed fields:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/export" \
  | jq '.media_references[] | {id, type, embedUrl, provider}'
# → the vid-1 row shows type "video", the embedUrl, provider "youtube"

# Re-import and confirm the video item is still a video:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/export" -o /tmp/d.json
DID=$(curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/import" \
  -H 'Content-Type: application/json' --data @/tmp/d.json | jq -r '.id')
npx wp-env run cli wp post meta get $DID media_items --format=json \
  | jq '.[] | select(.title=="A video") | {type, source, embedUrl, provider}'
# → type "video", source "external", embedUrl + provider preserved
```

**Expected (pass).** The exported `media_references` include `type`/`embedUrl`/`provider`, and the re-imported video item has `type:"video"` (not `"image"`) with its embed fields intact.

**Why it proves the fix.** Pre-fix, the export carried no `type`, and import forced `type:"image"` — the re-imported item was an image, losing the video. `type:"video"` surviving is only possible once both sides carry and honor it.

**Regression checks.** `WPSG_P65A_Campaign_IO_Test::test_media_type_and_embed_fields_survive_round_trip`. Backward compatibility: an old manifest with **no** `type` still imports as `image` (default), and image-only campaigns round-trip identically (no manifest version bump).

**Pitfalls.** A `type:"video"` item that is `source:"external"` needs its `embedUrl` to actually render in the gallery — the fix carries it, but if your source item never had an `embedUrl`, the re-imported video still won't play (that's a missing-source-data issue, not a P65-D regression). Verify with an item that has a real `embedUrl`.

---

## 5. Post-Landing PR Review Fixes (2026-07-18)

**What & why.** A self-review of the four P65 commits above (no GitHub PR existed yet) found two real bugs neither the original acceptance criteria nor §4's steps exercised. Both are fixed on-branch; this section verifies them the same way §4 does.

### Fix 1 — binary/ZIP campaign import preserves `embedUrl`/`provider`

**What & why.** P65-D's `build_entry()` (§4, P65-D) added `embedUrl`/`provider` to every export, and the JSON-only import path already carried them into the re-imported item. The ZIP/binary sideload path (`WPSG_Campaign_IO::upload_media_item()`) didn't — a video/embed item's metadata silently vanished if the campaign was ever exported/imported via ZIP instead of JSON.

**Reachability caveat — read before testing.** `source:"external"`/embed items (YouTube, Vimeo, etc.) have no real downloadable bytes at their `url` (it's a webpage, not a media file — see Fix 2's pitfall below and the FUTURE_TASKS entry "Binary Campaign Export Downloads Non-File URLs for Embed/External Media"), so they never get real bytes written into a ZIP export in the first place. This fix's effect on *those* specific items can't be observed via a live end-to-end binary export/import — the sideload fails (file-type validation) before this code ever runs, for reasons this fix doesn't touch. What this fix *does* guarantee: any media item that **does** get real bytes sideloaded via ZIP (an uploaded video that also happens to carry a `provider` value, or an MD5-dedup match against an existing attachment that carries embed metadata) keeps that metadata instead of losing it. Verify with a locally-built ZIP fixture — same technique as §4 Part 4's MD5-dedup test — not a live network round-trip.

```bash
# Build a ZIP whose manifest carries embedUrl/provider on a real-bytes entry:
npx wp-env run cli sh -c '
  cd /var/www/html/wp-content/plugins/wp-super-gallery &&
  php -r "
    \$z=new ZipArchive; \$z->open(\"/tmp/embed.zip\",ZipArchive::CREATE|ZipArchive::OVERWRITE);
    \$m=[\"version\"=>2,\"campaign\"=>[\"title\"=>\"Embed Fields\"],\"layout_template\"=>null,
      \"media_references\"=>[[
        \"id\"=>\"vid-1\",\"title\"=>\"A Video\",\"type\"=>\"video\",
        \"filename\"=>\"media-vid-1.jpg\",
        \"embedUrl\"=>\"https://example.com/embed/1\",\"provider\"=>\"youtube\"]]];
    \$z->addFromString(\"manifest.json\",json_encode(\$m));
    \$z->addFromString(\"media/media-vid-1.jpg\", file_get_contents(\"tests/stubs/1x1.jpg\"));
    \$z->close();" &&
  wp wpsg campaign import /tmp/embed.zip'
# Grab the new campaign ID from the success line, then:
npx wp-env run cli wp post meta get <NEW_ID> media_items --format=json \
  | jq '.[0] | {type, source, embedUrl, provider}'
# → type "video", source "upload", embedUrl "https://example.com/embed/1", provider "youtube"
```

**Expected (pass).** `embedUrl` and `provider` are present and correct. **Pre-fix**, this same ZIP would import with `type:"video"` correct (P65-D's original fix already covered `type`) but `embedUrl`/`provider` **absent** from the re-imported item — `jq` prints `null` for both.

**Regression checks.** `WPSG_P65A_Campaign_IO_Test::test_zip_import_preserves_embed_fields`.

### Fix 2 — multi-campaign batch ZIP export references the file actually in the archive

**What & why.** `batch_export_binary()` (`POST /campaigns/batch/export/binary`) dedupes media **by URL** across every campaign in the batch — only the first campaign to reference a given URL gets its file written into the ZIP. But each campaign's manifest `filename` was derived from *that campaign's own* media-item id, independent of the dedup. A second campaign sharing a URL with an earlier one in the batch got a manifest entry pointing at a filename never written to the archive — silently dropped on re-import (`stream_zip_entry_to_file` returns false → the item lands in `media_skipped`, no error surfaced beyond that list). This bug pre-dates Phase 65 (the dedup/filename logic was carried over unchanged by P65-A's consolidation) but had zero test coverage until this pass.

```bash
# Two campaigns sharing one real, fetchable media URL — use an attachment
# already on this site so the export's HTTP fetch succeeds without an
# external network dependency:
ATT_URL=$(npx wp-env run cli wp eval 'echo wp_get_attachment_url(get_posts(["post_type"=>"attachment","posts_per_page"=>1])[0]->ID ?? 0);')
# If empty, upload any image through the admin SPA once first, then re-run.

CID_A=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='Batch A' --post_status=publish --porcelain)
CID_B=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='Batch B' --post_status=publish --porcelain)
npx wp-env run cli wp eval "update_post_meta($CID_A, 'media_items', [['id'=>'a-item','url'=>'$ATT_URL','title'=>'Shared']]);"
npx wp-env run cli wp eval "update_post_meta($CID_B, 'media_items', [['id'=>'b-item','url'=>'$ATT_URL','title'=>'Shared']]);"

JOB=$(curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/batch/export/binary" \
  -H 'Content-Type: application/json' -d "{\"ids\":[$CID_A,$CID_B]}" | jq -r '.jobId')
npx wp-env run cli wp cron event run wpsg_export_process_job
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB/download" -o /tmp/batch.zip

unzip -p /tmp/batch.zip manifest.json \
  | jq '[.campaigns[].media_references[0].filename]'
# → both entries show the SAME filename
unzip -l /tmp/batch.zip | grep media/
# → exactly one media/ file, and its name matches both manifest entries above
```

**Expected (pass).** Both campaigns' `media_references[0].filename` are identical, and that filename is present in the archive. **Pre-fix**, campaign B's filename would be derived from `b-item` (e.g. `media-b-item.jpg`) while the archive only contains the file written under campaign A's id (`media-a-item.jpg`) — re-importing campaign B's manifest entry alone would report it in `media_skipped` with reason "Entry not found in archive."

**Regression checks.** `WPSG_P39CM1_Export_Test::test_batch_export_manifest_filenames_match_zip_for_shared_media`.

**Pitfalls.** Don't use two different placeholder URLs for this test — the dedup only collapses entries sharing the *exact same* `url` string; different URLs are supposed to each get their own file. Also don't substitute an external `source:"external"` embed item as the "shared URL" here — as noted in Fix 1's caveat, those never get real bytes into a ZIP in the first place (a separate, deferred issue), which would make this test's HTTP fetch fail for unrelated reasons.

**Regression checks (whole section).** Full PHPUnit suite green — **1219 tests, 13437 assertions, 0 failures, 2 pre-existing skips** (up from 1217/13430 before these two fixes).

---

## 6. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P65-A (A-4) | JSON export carries the template; re-import binds a CRUD-resolvable template; zero `wpsg_layout_template` orphans | Binary/CLI paths unchanged; `import_single_campaign_from_zip` removed | ☐ |
| P65-A (G-4) | URL-only import → `source:"external"` | `create_media` enum aligned to the sanitizer allowlist | ☐ |
| P65-A (datetime) | CLI import normalizes a non-canonical datetime to `Y-m-d H:i:s` | REST paths unchanged | ☐ |
| P65-A (dedup) | CLI ZIP import dedupes identical bytes to one attachment | REST-ZIP dedup unchanged | ☐ |
| P65-A (attachmentId) | Sideloaded media carry `attachmentId`; not listed by `media orphans` | Enrichment (dimensions/tags) now applies to imported media | ☐ |
| P65-A (parity/E-4) | All four transports produce a resolvable template + correct source | Big-file import doesn't spike memory (optional) | ☐ |
| P65-B (A-5) | Campaign-filtered media export includes the campaign's files (`item_count ≥ 1`) | Unfiltered library export unchanged | ☐ |
| P65-B (E-4) | Media-library ZIP import round-trips via the streaming reader | — | ☐ |
| P65-C | Audit + media export manifests carry accurate `total_available` + `truncated:false` within cap | Within-cap export otherwise unchanged | ☐ |
| P65-D | Video/embed `type` + `embedUrl`/`provider` survive export→import | Absent `type` defaults to image; image-only round-trips identical | ☐ |
| Post-landing Fix 1 | ZIP/binary import preserves `embedUrl`/`provider` on real-bytes sideloaded items | JSON path (P65-D) unchanged | ☐ |
| Post-landing Fix 2 | Batch export's shared-URL media reference the same, actually-archived filename across campaigns | Single-campaign binary export (§4 Part 6) unchanged | ☐ |

**Automated baseline (must be green alongside manual QA):** full wp-env PHPUnit suite — **1219 tests, 13437 assertions, 0 failures, 2 pre-existing skips** as of the post-landing PR review pass (2026-07-18; was 1217/13430 at original phase landing). See PHASE65_REPORT.md → each track's *Implementation* block, and "Post-Landing PR Review & Fix Pass," for details.
