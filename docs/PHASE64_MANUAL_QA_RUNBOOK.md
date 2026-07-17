# Phase 64 — Manual QA & Validation Runbook

**Companion to:** [PHASE64_REPORT.md](PHASE64_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand — exact preconditions, commands, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test. It follows the format established in [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md).

**Scope:** tracks P64-A … P64-G. Each track section is self-contained. Do the shared setup once (§1–§3), then run the tracks in any order.

**Golden rule (unchanged from P63):** a fix's test is only meaningful if you have also seen it **fail without the fix**, or you understand precisely why the pre-fix code was wrong. Each section states the pre-fix behavior so a green result actually proves something. When in doubt, `git stash` the fix on a scratch branch and re-run to watch it fail.

**A note on "N/A" sections.** Several Phase 64 tracks are pure refactors (P64-A) or narrow correctness fixes whose behavior is fully pinned by automated tests with no distinct user-facing surface. For those, the "Manual QA" entry states **N/A with a rationale** rather than inventing a ritual that proves nothing — mirroring how P63-F handled its pure IP-classification helper.

---

## 1. Environment

| Requirement | Why |
|---|---|
| Local `wp-env` dev site (`npx wp-env start` from repo root) | Standard test host. |
| `curl` (with `-i`/`-s`) | REST assertions are scriptable and unambiguous. |
| A working outbound mailer OR a mail-catcher | P64-C/-D exercise `wp_mail`. wp-env has no real MTA — use a logging drop-in (below) to *observe* what would be sent. |
| A built SPA (`npm run build:wp`) for the frontend tracks (P64-B UI, P64-G) | The Access tab / Space management confirm dialogs are React; test them in the admin SPA. |
| Base URL | wp-env default is `http://localhost:8888`. Substitute `$BASE`. |

```bash
export BASE=http://localhost:8888
```

**Observing outbound mail without an MTA (P64-C, P64-D).** wp-env can't actually deliver mail, so to *assert on what would be sent*, drop a tiny mu-plugin that records every `wp_mail()` call:

```php
// wp-content/mu-plugins/wpsg-mail-log.php
<?php
add_filter('pre_wp_mail', function ($null, $atts) {
    file_put_contents(
        WP_CONTENT_DIR . '/wpsg-mail.log',
        gmdate('c') . "\tTO=" . (is_array($atts['to']) ? implode(',', $atts['to']) : $atts['to'])
            . "\tSUBJ=" . $atts['subject'] . "\n",
        FILE_APPEND
    );
    return true; // short-circuit: pretend success, send nothing
}, 10, 2);
```

Then `tail -f wp-content/wpsg-mail.log` while you exercise an endpoint. Each line is one message the site *tried* to send, with recipient + subject — enough to prove "an email to the requester did / did not fire."

---

## 2. Test personas & the RBAC model

Phase 64 touches the same authorization model as Phase 63 — re-read **§2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md)** for the persona table (System Admin / delegated editor / reader), how to create them, and how to authenticate REST calls (Application Passwords for curl). The one addition Phase 64 leans on heavily:

**Grant *source* matters here.** A user can hold access to a campaign two ways:
- a **campaign-level** grant (`source: 'campaign'`, stored in campaign postmeta), or
- a **company-level** grant (`source: 'company'`, stored in the company term's meta, propagated to every campaign of that company).

P64-B's whole point is that "revoke from this campaign" must mean different things for these two cases. Keep them straight while testing: check where a grant lives (`get_post_meta($cid, 'access_grants')` vs `get_term_meta($company_term_id, 'access_grants')`).

---

## 3. Reusable setup recipes

Same as [PHASE63_MANUAL_QA_RUNBOOK.md §3](PHASE63_MANUAL_QA_RUNBOOK.md) for spaces/grants. Campaign-and-company specific recipes:

```bash
# Create a company (taxonomy term) and note its term_id:
npx wp-env run cli wp term create wpsg_company "Acme" --porcelain   # → prints TERM_ID

# Create a campaign and attach it to the company + give it an id you can use:
CID=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='Acme Spring' --post_status=publish --porcelain)
npx wp-env run cli wp post term set $CID wpsg_company <TERM_ID>

# Grant a user COMPANY-wide access (propagates to every Acme campaign):
curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/companies/<TERM_ID>/access" \
  -H 'Content-Type: application/json' -d '{"userId":<UID>,"access_level":"viewer"}'

# Grant a user CAMPAIGN-level access to one campaign:
curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/access" \
  -H 'Content-Type: application/json' -d '{"userId":<UID>,"source":"campaign"}'

# Read a campaign's effective access list (shows source per entry):
curl -s -u 'sysadmin:APPPW' "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/access" | jq '.items[] | {userId,source,access_level}'
```

---

## 4. Track-by-track

---

### P64-A — Shared `WPSG_Grants` helper (pure refactor)

**What & why.** Access-grant list logic (upsert-by-user, remove-by-user, expiry checks, `expires_at` parsing, access-level normalization, page-slice user enrichment) was copy-pasted across ~10 call sites in five files (`class-wpsg-access-controller.php`, `class-wpsg-space-controller.php`, `class-wpsg-rest-base.php`, `class-wpsg-maintenance.php`, and `class-wpsg-monitoring.php`). P64-A extracts all of it into one `WPSG_Grants` class. **This is a behavior-preserving refactor** — storage stays exactly where it is (postmeta / termmeta / space-JSON); no schema change, no endpoint contract change.

**Manual QA: N/A (rationale).** By design there is *no* observable behavior change to test by hand — the whole acceptance criterion is "the existing grant/access test matrix passes unmodified." Inventing a manual ritual here would prove nothing that the automated suite doesn't already pin far more precisely. The correctness of the extraction is established by:

1. **New direct unit tests** — `WPSG_P64A_Grants_Helper_Test` asserts each `WPSG_Grants` method in isolation, including the expiry **edge cases** that the old inline copies handled inconsistently (empty string, `'0'`, unparseable dates, injected `now`) and the malformed-`expires_at` → `WP_Error` path.
2. **The full pre-existing suite staying green** — every P28-B / P28-J / P33-B / P33-C / P47 / P53 test that exercises the refactored call sites through the real REST endpoints continues to pass with **zero test-file edits**. That is the regression proof: if the refactor changed any observable behavior, one of those endpoint-level tests would move.

**One deliberate correctness nuance (worth knowing, not a behavior change in practice).** The canonical `WPSG_Grants::is_expired()` treats an **unparseable** `expires_at` as *not expired* (rather than the old inline `strtotime($x) < now` form, where `strtotime()` returning `false` cast to `0` and made garbage look "expired since 1970"). Real grants only ever store `null` or a valid ISO-8601 string produced by `gmdate('c', …)`, so no production/test data hits this path — but the helper is now robust if it ever did.

**If you want a smoke check anyway.** Exercise one endpoint of each refactored shape and confirm it still works normally:
```bash
# Grant, list (source + level present), revoke — should behave exactly as before.
curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/access" \
  -H 'Content-Type: application/json' -d '{"userId":<UID>,"source":"campaign"}' | jq .
curl -s -u 'sysadmin:APPPW' "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/access" | jq '.items[0]'
# Invalid expiry still rejected with the same message from one place:
curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/access" \
  -H 'Content-Type: application/json' -d '{"userId":<UID>,"source":"campaign","expires_at":"not-a-date"}' | jq .
# → 400 wpsg_invalid_expires_at "expires_at must be a valid ISO 8601 datetime"
```

**Regression checks.** Full PHPUnit suite green (see the sign-off table). `grep -rn "upsert_grant\|upsert_override\|upsert_space_grant" includes/` returns **zero** hits (all three private copies removed). `grep -rn "strtotime(\$expires_at)\|strtotime(\$entry\['expires_at'\])" includes/` returns only the `WPSG_Grants` definition and the unrelated `magic_key_expires_at` check (a magic-link key, not a grant — deliberately out of scope).

---
