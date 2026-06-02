# Webhook Manual Testing Guide (P39-IN1)

Manual end-to-end test procedure for the WPSG webhook system. Covers REST route
verification, endpoint CRUD, event delivery, HMAC signature verification, event
filtering, and secret rotation.

---

## Prerequisites

### 1. Receiver URL

Open [webhook.site](https://webhook.site) and copy your unique URL
(`https://webhook.site/<uuid>`). Keep the tab open — incoming requests appear
in real time.

### 2. Local WordPress environment

```bash
npx wp-env start
```

If the environment was previously stopped or is showing database errors, restart
it:

```bash
npx wp-env stop && npx wp-env start
```

### 3. Application Password

WordPress REST API requires an Application Password — plain admin credentials
are rejected.

```bash
npx wp-env run cli wp user application-password create admin test-token --porcelain
```

Save the printed token. Use it as `<APP_PASS>` throughout this guide.

### 4. Nonce

Admin routes require an `X-WP-Nonce` header in addition to Application Password
auth. Generate one:

```bash
NONCE=$(npx wp-env run cli wp eval --user=1 'echo wp_create_nonce("wp_rest");' 2>/dev/null)
echo "NONCE=[$NONCE]"
```

The nonce is valid for ~12 hours. If you open a new terminal session, re-run
this command to refresh `$NONCE`.

> **Note:** Run the plugin activation hook once after a fresh `wp-env start` to
> ensure the `manage_wpsg` capability is assigned to the Administrator role:
>
> ```bash
> npx wp-env run cli wp plugin deactivate wp-super-gallery
> npx wp-env run cli wp plugin activate wp-super-gallery
> ```

---

## Helper alias

All admin curl calls share the same auth flags. Define a shell alias to keep
commands short:

```bash
WP_AUTH='-u "admin:<APP_PASS>" -H "X-WP-Nonce: $NONCE"'
```

Or just paste the flags directly — they are shown in full in each command below.

---

## Step 1 — Verify REST routes

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/webhooks
```

Expected: `[]`

---

## Step 2 — Create an endpoint

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"url":"https://webhook.site/<YOUR-UUID>","events":[],"enabled":true}' \
  http://localhost:8888/wp-json/wp-super-gallery/v1/webhooks
```

The response includes a `secret` field — this is the only time it is shown.
**Save it.**

---

## Step 3 — Trigger an event and verify delivery

Create a campaign:

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"title":"Webhook Test Campaign"}' \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns
```

webhook.site should receive a POST with body:

```json
{
  "event": "campaign.created",
  "timestamp": "<ISO8601>",
  "data": { "id": <n>, "title": "Webhook Test Campaign" }
}
```

And headers including `X-WPSG-Signature: sha256=<hex>`.

---

## Step 4 — Verify the HMAC signature

Use the compact (non-pretty-printed) body exactly as received and the secret
from Step 2:

```bash
echo -n '<COMPACT_BODY>' | openssl dgst -sha256 -hmac '<SECRET>'
```

The hex output must match the value after `sha256=` in the `X-WPSG-Signature`
header.

> **Getting the compact body:** webhook.site may display pretty-printed JSON.
> Reconstruct the compact form by removing all whitespace between tokens, or
> copy from the "Raw" view if available. Key rule: the body that was signed is
> exactly what `wp_json_encode()` produced — compact, no trailing newline.

---

## Step 5 — Event filtering

Create a second endpoint that only receives `campaign.archived`:

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"url":"https://webhook.site/<YOUR-UUID>","events":["campaign.archived"],"enabled":true}' \
  http://localhost:8888/wp-json/wp-super-gallery/v1/webhooks
```

**Create a campaign** — webhook.site should receive exactly **one** delivery
(`campaign.created` goes to the all-events endpoint only).

**Archive the campaign** using the dedicated archive route (not a PUT to update
status):

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X POST \
  http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns/<ID>/archive
```

webhook.site should now receive **two** deliveries — one `campaign.archived` to
each endpoint.

---

## Step 6 — Secret rotation

> **Important:** When deleting multiple endpoints in sequence, always delete
> from the **highest index down to 0**. Each deletion calls `array_values()`
> internally, which re-indexes the stored array. Deleting index 0 first causes
> index 1 to become the new index 0, and a subsequent `DELETE /webhooks/1` will
> target the wrong slot (or a non-existent one).

Clean up and start with a single endpoint for this test. Check the current
state:

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/webhooks
```

Delete from highest index downward, then recreate one endpoint (save the
`secret` — this is the **old secret**).

Rotate the secret:

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  -X POST \
  http://localhost:8888/wp-json/wp-super-gallery/v1/webhooks/0/rotate-secret
```

Save the `secret` from this response — this is the **new secret**.

Trigger an event, then verify both secrets against the delivered signature:

```bash
# New secret — must match the X-WPSG-Signature value
echo -n '<COMPACT_BODY>' | openssl dgst -sha256 -hmac '<NEW_SECRET>'

# Old secret — must NOT match
echo -n '<COMPACT_BODY>' | openssl dgst -sha256 -hmac '<OLD_SECRET>'
```

---

## Step 7 — Delivery log

```bash
curl -s \
  -u "admin:<APP_PASS>" \
  -H "X-WP-Nonce: $NONCE" \
  http://localhost:8888/wp-json/wp-super-gallery/v1/webhooks/delivery-log
```

Returns up to 50 entries: `deliveryId`, `event`, `url`, `attempt`, `success`,
`statusCode`, `timestamp`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `rest_forbidden` 401 | Plain password used | Generate an Application Password |
| `rest_forbidden` 403 | `manage_wpsg` cap missing or nonce absent | Re-run plugin activate; regenerate `$NONCE` |
| `rest_no_route` 404 | Typo in URL (e.g. `/webhook` not `/webhooks`) | Check the URL |
| Empty response body | `[]` printed before the bash prompt | That *is* the response — success |
| Database error on `wp-env start` | MySQL container not ready | `npx wp-env stop && npx wp-env start` |
| HMAC mismatch | Wrong endpoint's secret used, or wrong body (pretty-printed vs compact) | Check stored secrets with `npx wp-env run cli wp option get wpsg_webhook_endpoints --format=json`; use compact body |
| Rotation applied to wrong endpoint | Endpoints re-indexed after a deletion | Always delete from highest index down; verify state with `GET /webhooks` before rotating |
