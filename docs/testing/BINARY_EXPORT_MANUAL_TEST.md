# Binary Export Manual Testing Guide (P39-CM1)

Manual end-to-end test procedure for the WPSG binary campaign export system.
Covers REST route verification, background job lifecycle, ZIP inspection,
binary import round-trip, and CLI usage.

---

## Prerequisites

### 1. Local WordPress environment

```bash
npx wp-env start
```

If the environment was previously stopped or is showing database errors:

```bash
npx wp-env stop && npx wp-env start
```

### 2. ext-zip availability

The binary export requires PHP's `ZipArchive` extension (`ext-zip`). Verify it
is available in the wp-env container:

```bash
npx wp-env run cli php -r "echo class_exists('ZipArchive') ? 'ZipArchive: YES' : 'ZipArchive: MISSING';"
```

Expected: `ZipArchive: YES`

### 3. Application Password

```bash
npx wp-env run cli wp user application-password create admin test-token --porcelain
```

Save the printed token. Use it as `<APP_PASS>` throughout this guide.

### 4. Nonce

Admin routes require an `X-WP-Nonce` header alongside Application Password
auth. Generate one:

```bash
NONCE=$(npx wp-env run cli wp eval --user=1 'echo wp_create_nonce("wp_rest");' 2>/dev/null)
echo "NONCE=[$NONCE]"
```

The nonce is valid for ~12 hours. Re-run this in any new terminal session.

> **Note:** After a fresh `wp-env start`, run the plugin activation sequence to
> ensure the `manage_wpsg` capability is assigned:
>
> ```bash
> npx wp-env run cli wp plugin deactivate wp-super-gallery
> npx wp-env run cli wp plugin activate wp-super-gallery
> ```

### 5. A note on media URLs in wp-env

The export engine fetches media binaries via `wp_remote_get()`. Inside the
wp-env container, URLs of the form `http://localhost:8888/...` do not resolve
(that is the host port mapping, not the container-internal address). To avoid
this, the test campaign below uses publicly accessible external image URLs.
Real deployments serve media from a URL that is reachable from the server's own
HTTP client, which is the normal case.

---

## Helper variable

All admin curl calls share the same auth flags. To keep commands readable,
define:

```bash
AUTH='-u "admin:<APP_PASS>" -H "X-WP-Nonce: '$NONCE'"'
```

Or paste the flags directly — each command below shows them in full.

---

## Step 1 — Verify new REST routes are registered

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  http://localhost:8888/wp-json/wp-super-gallery/v1 \
  | python3 -m json.tool | grep -E "export|import/binary"
```

Expected: lines containing:
- `/wp-super-gallery/v1/campaigns/(?P<id>\d+)/export/binary`
- `/wp-super-gallery/v1/campaigns/import/binary`
- `/wp-super-gallery/v1/export-jobs/...`

---

## Step 2 — Create a test campaign with external media

Create a campaign via CLI and assign two publicly accessible image URLs as
media items. External URLs are used here to bypass the wp-env internal
networking constraint described in the prerequisites.

```bash
# Create campaign post
CID=$(npx wp-env run cli wp post create \
  --post_type=wpsg_campaign \
  --post_title="Binary Export Test" \
  --post_status=publish \
  --porcelain)
echo "Campaign ID: $CID"

# Set required meta
npx wp-env run cli wp post meta update $CID status active
npx wp-env run cli wp post meta update $CID visibility public

# Set media items using wp eval (avoids PHP serialization pitfalls)
npx wp-env run cli wp eval "
  update_post_meta($CID, 'media_items', [
    ['id'=>'m1','url'=>'https://picsum.photos/seed/wpsg1/400/300','title'=>'Photo 1','type'=>'image','source'=>'url','order'=>0],
    ['id'=>'m2','url'=>'https://picsum.photos/seed/wpsg2/400/300','title'=>'Photo 2','type'=>'image','source'=>'url','order'=>0],
  ]);
  echo 'Media items set.';
"
```

Verify the campaign exists:

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/$CID
```

Expected: JSON object with `"title": "Binary Export Test"` and `"status": "active"`.

---

## Step 3 — Start a binary export job

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X POST \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/$CID/export/binary
```

Expected: `HTTP 202`

```json
{
  "jobId": "<32-char hex string>",
  "status": "pending"
}
```

Save the job ID:

```bash
JOB_ID="<jobId from above>"
```

---

## Step 4 — Trigger the WP-Cron job

The export engine schedules a WP-Cron event (`wpsg_export_process_job`) to run
the ZIP builder in the background. In wp-env, trigger it explicitly:

```bash
npx wp-env run cli wp cron event run wpsg_export_process_job --due-now
```

This runs all pending `wpsg_export_process_job` events. If the export has
already fired automatically, this is a no-op.

---

## Step 5 — Poll job status

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/export-jobs/$JOB_ID \
  | python3 -m json.tool
```

Expected when complete:

```json
{
  "jobId": "<JOB_ID>",
  "type": "campaign",
  "status": "complete",
  "createdAt": "<ISO8601>",
  "error": null,
  "downloadUrl": "http://localhost:8888/wp-json/wp-super-gallery/v1/export-jobs/<JOB_ID>/download"
}
```

If `status` is still `"pending"` or `"processing"`, re-run Step 4 and poll
again. A `"failed"` status will include an `"error"` message describing the
cause.

---

## Step 6 — Download the ZIP

```bash
curl -s \
  -o campaign-$CID.zip \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  "http://localhost:8888/wp-json/wp-super-gallery/v1/export-jobs/$JOB_ID/download"

ls -lh campaign-$CID.zip
```

Expected: a file named `campaign-<CID>.zip` with a non-zero size.

### Inspect the ZIP structure

```bash
unzip -l campaign-$CID.zip
```

Expected output shape:

```
Archive:  campaign-<CID>.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
     3241  2026-06-02 09:00   manifest.json
    45231  2026-06-02 09:00   media/media-m1.jpg
    39187  2026-06-02 09:00   media/media-m2.jpg
---------                     -------
    87659                     3 files
```

`manifest.json` is always present. Each media entry appears as
`media/media-{id}.{ext}` — the filename is derived deterministically from the
media item's `id` field.

### Inspect the manifest

```bash
unzip -p campaign-$CID.zip manifest.json | python3 -m json.tool
```

Check:
- `"version": 2`
- `"campaign"` block contains the correct title and metadata
- Each entry in `"media_references"` has an `"id"`, `"url"`, `"title"`, and
  `"filename"` field
- The `"filename"` values match the entries listed under `media/` by
  `unzip -l`

---

## Step 7 — Binary import via REST

Upload the ZIP and import it as a new campaign:

```bash
IMPORT_RESP=$(curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X POST \
  -F "file=@campaign-$CID.zip" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/import/binary)

echo "$IMPORT_RESP" | python3 -m json.tool

NEW_CID=$(echo "$IMPORT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Imported as campaign ID: $NEW_CID"
```

Expected: `HTTP 201`

```json
{
  "id": <new_id>,
  "title": "Binary Export Test",
  "status": "draft",
  ...
}
```

Verify:
- A **new** campaign ID was created (different from `$CID`).
- `"status"` is `"draft"` — binary import always lands as draft, same as JSON
  import.
- `"title"` matches the original campaign title.

Verify media items were sideloaded:

```bash
npx wp-env run cli wp post meta get $NEW_CID media_items --format=json
```

Expected: a JSON array with two entries, each having a `"source": "upload"` key
and a real attachment URL under `"url"`.

> **Media in wp-env:** `media_handle_sideload()` writes new WP attachments to
> the uploads directory inside the container. If sideloading fails (e.g., the
> container's MIME type check rejects the picsum redirect body), the campaign is
> still created with an empty media list rather than returning a 500 error. The
> item count in the CLI import (`Media: N imported, M skipped`) is the reliable
> indicator of whether sideloading succeeded.

### Confirm in the admin

Open `http://localhost:8888/wp-admin` → Campaigns and verify the imported
campaign appears in the list with status "Draft".

---

## Step 8 — Job cleanup

After a successful download, delete the server-side job and its ZIP file:

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X DELETE \
  "http://localhost:8888/wp-json/wp-super-gallery/v1/export-jobs/$JOB_ID"
```

Expected: `{"deleted": true}`

Polling the job ID again should now return `404`:

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/export-jobs/$JOB_ID \
  | python3 -m json.tool
```

Expected: `HTTP 404`

---

## Step 9 — CLI binary export

The CLI export path is synchronous: it creates the job and processes it
immediately without relying on WP-Cron.

The plugin directory is bind-mounted into the CLI container at
`/var/www/html/wp-content/plugins/wp-super-gallery`, so writing the output
there makes it immediately visible on the host at `wp-plugin/wp-super-gallery/`.

```bash
# Export from within the container, writing to the mounted plugin dir
npx wp-env run cli wp wpsg campaign export $CID \
  --format=binary \
  --output=/var/www/html/wp-content/plugins/wp-super-gallery/campaign-$CID-cli.zip
```

Expected:

```
Building ZIP for campaign <CID>…
Success: Binary export written to: /var/www/html/wp-content/plugins/wp-super-gallery/campaign-<CID>-cli.zip
```

The file is now accessible on the host:

```bash
ls -lh wp-plugin/wp-super-gallery/campaign-$CID-cli.zip
unzip -l wp-plugin/wp-super-gallery/campaign-$CID-cli.zip
```

The structure should be identical to the REST-generated ZIP.

### CLI binary import

Copy the ZIP into the mounted directory, then import it:

```bash
# Make a copy for import (so the original is preserved)
cp wp-plugin/wp-super-gallery/campaign-$CID-cli.zip \
   wp-plugin/wp-super-gallery/campaign-import-test.zip

npx wp-env run cli wp wpsg campaign import \
  /var/www/html/wp-content/plugins/wp-super-gallery/campaign-import-test.zip
```

Expected:

```
Success: Campaign imported (binary). New ID: <n>. Media: 2 imported, 0 skipped.
```

Clean up the test ZIPs from the plugin directory:

```bash
rm -f wp-plugin/wp-super-gallery/campaign-$CID-cli.zip \
       wp-plugin/wp-super-gallery/campaign-import-test.zip
```

> **Media counts:** The CLI import calls `media_handle_sideload()` via the WP
> filesystem, which is accessible inside the container. A `0 imported, 2
> skipped` result indicates a sideload failure — check the warning lines printed
> above the success line for the specific error.

---

## Step 10 — Error cases

### 10a — Download before job completes

Start a new export job but do **not** trigger the cron event. Then immediately
try to download — the job should still be pending.

> **Timing note:** The WordPress REST API calls `spawn_cron()` after each
> request. Because the export event is scheduled for `time()` (immediate), it
> may fire automatically on the next incoming request. If the 409 does not
> appear, the cron fired before the download attempt — that is correct
> behaviour, not a bug. Check the job status with Step 5 to confirm.

```bash
JOB_PENDING=$(curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X POST \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/$CID/export/binary \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")

# Attempt download immediately (before triggering cron)
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  "http://localhost:8888/wp-json/wp-super-gallery/v1/export-jobs/$JOB_PENDING/download"
```

Expected (if cron has not yet fired): `HTTP 409` — `"Export is not complete (status: pending)"`

Clean up:

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X DELETE \
  "http://localhost:8888/wp-json/wp-super-gallery/v1/export-jobs/$JOB_PENDING"
```

### 10b — Import with a wrong manifest version

Create a ZIP with a version-1 manifest (the original JSON export format):

```bash
# Get a JSON export, zip it up as if it were a binary export
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/$CID/export \
  > manifest_v1.json

# Create a ZIP with this as the manifest
python3 -c "
import zipfile, shutil
with zipfile.ZipFile('/tmp/bad-version.zip', 'w') as z:
    z.write('manifest_v1.json', 'manifest.json')
"

curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X POST \
  -F "file=@/tmp/bad-version.zip" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/import/binary
```

Expected: `HTTP 400` — `"Binary import requires manifest version 2"`

### 10c — Import with no manifest.json

```bash
python3 -c "
import zipfile
with zipfile.ZipFile('/tmp/no-manifest.zip', 'w') as z:
    z.writestr('readme.txt', 'no manifest here')
"

curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X POST \
  -F "file=@/tmp/no-manifest.zip" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/import/binary
```

Expected: `HTTP 400` — `"manifest.json not found in archive"`

### 10d — Export of a non-existent campaign

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X POST \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/999999/export/binary
```

Expected: `HTTP 404` — `"Campaign not found"`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `rest_forbidden` 401 | Plain password used | Use an Application Password |
| `rest_forbidden` 403 | `manage_wpsg` cap missing or nonce absent | Re-run plugin deactivate/activate; regenerate `$NONCE` |
| Job stuck at `pending` after cron trigger | WP-Cron already ran and failed silently | Poll the job — check `error` field; re-run `wp cron event run` |
| `status: failed`, `error: "ext-zip is required"` | `ZipArchive` not available in the container | Verify with `npx wp-env run cli php -r "echo class_exists('ZipArchive');"` |
| `status: failed`, `error: "Export would exceed … MB size limit"` | Total media size exceeds 100 MB | Use a campaign with fewer or smaller media items for testing |
| ZIP downloaded but is 0 bytes | Download route fired before job completed | Check job status first (`GET /export-jobs/{id}`); wait for `complete` |
| `media: 0 imported, N skipped` in CLI import | `media_handle_sideload()` failed | Check WP error: run with `--debug` or inspect `wp_error` messages; ensure uploads directory is writable |
| `docker cp` finds no CLI container | Container filter did not match | Run `docker ps` and copy the CLI container ID manually |
| Cron trigger says `0 due events` | Job already processed (or too soon) | The cron event may have already fired; just poll the job status |
