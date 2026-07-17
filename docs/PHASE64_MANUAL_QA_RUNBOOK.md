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

### P64-B — Campaign-scoped revoke no longer wipes company-wide access

**What & why.** Pre-fix, `DELETE /campaigns/{id}/access/{userId}` deleted the user's grants from campaign postmeta, campaign overrides, **and company termmeta** — so revoking one campaign silently revoked every campaign of that company, and a space editor (who can reach this endpoint via `require_campaign_space_access`) could destroy System-Admin-tier company grants. Fix: the campaign endpoint **never touches company termmeta**. For a company-sourced user it writes a per-campaign **deny override** (block this campaign only); for a campaign-sourced user it removes the campaign grant. The response `removed` field reports which happened. The frontend gates every revoke behind a confirm dialog whose copy states the actual outcome.

**Preconditions.** System Admin + a delegated editor (see PHASE63 §2). A company with **two** campaigns A and B (recipe in §3). A subscriber `victim` you can grant/revoke.

#### Part 1 — PHP: company-sourced revoke blocks one campaign, keeps the rest

**Steps.**
```bash
# Grant victim COMPANY-wide access; confirm they can reach both A and B.
curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/companies/<TERM>/access" \
  -H 'Content-Type: application/json' -d '{"userId":<VICTIM>,"access_level":"viewer"}'

# Revoke victim from campaign A only:
curl -s -u 'sysadmin:APPPW' -X DELETE "$BASE/wp-json/wp-super-gallery/v1/campaigns/<A>/access/<VICTIM>" | jq .
# → { "message":"Access revoked", "removed":"deny_override_added" }

# The company grant is untouched:
curl -s -u 'sysadmin:APPPW' "$BASE/wp-json/wp-super-gallery/v1/companies/<TERM>/access" | jq '.items[] | select(.userId==<VICTIM>)'
# → still present (source: "company")

# Campaign A now carries a deny override for victim; campaign B has none.
npx wp-env run cli wp post meta get <A> access_overrides
npx wp-env run cli wp post meta get <B> access_overrides   # empty
```

**Expected (pass).** `removed: "deny_override_added"`; the company grant survives; campaign A has a `deny` override for victim; campaign B has none. If you log in as `victim`, they can view campaign B but not A.

**Why it proves the fix.** The company grant surviving proves termmeta wasn't touched; the deny override on A (and its absence on B) proves "block this campaign only." Pre-fix, the company grant would be **gone** and victim would lose B as well.

#### Part 2 — PHP: campaign-sourced revoke removes only the campaign grant

**Steps.**
```bash
curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/<A>/access" \
  -H 'Content-Type: application/json' -d '{"userId":<VICTIM2>,"source":"campaign"}'
curl -s -u 'sysadmin:APPPW' -X DELETE "$BASE/wp-json/wp-super-gallery/v1/campaigns/<A>/access/<VICTIM2>" | jq .
# → { ..., "removed":"campaign_grant" }
npx wp-env run cli wp post meta get <A> access_overrides   # empty — no redundant deny override
```

**Expected (pass).** `removed: "campaign_grant"`; the campaign grant is gone; **no** deny override is written (nothing to override).

#### Part 3 — PHP: the tier fix (a space editor cannot destroy company grants)

**Steps.** Put campaign A in a **space S**; grant the delegated **editor** access to S (not to the company). Grant `victim` company-wide access. Then, **as the editor**, revoke victim from A:
```bash
curl -s -u 'editor_a:APPPW' -X DELETE "$BASE/wp-json/wp-super-gallery/v1/campaigns/<A>/access/<VICTIM>" | jq .
# → 200, removed:"deny_override_added"
curl -s -u 'sysadmin:APPPW' "$BASE/wp-json/wp-super-gallery/v1/companies/<TERM>/access" | jq '.items[] | select(.userId==<VICTIM>)'
# → STILL present
```

**Expected (pass).** The editor's revoke succeeds (200) but only adds a campaign deny override — the company grant **survives**. Pre-fix, the editor's single call would have deleted the System-Admin-tier company grant.

**Why it proves the fix.** The editor never had rights to company grants; post-fix the campaign endpoint physically cannot reach them. The company-wide revoke (`DELETE /companies/{id}/access/{userId}`) remains System-Admin-only and unchanged.

#### Part 4 — Frontend: the confirm dialog states the real outcome

**Steps (admin SPA → WP Super Gallery → Access tab).**
1. **Campaign view**, company-sourced row → click the red trash icon.
2. **Company (or All) view**, company-sourced row → click trash.
3. **Any view**, campaign-sourced row → click trash.

**Expected (pass).**
- (1) Dialog titled **"Block on this campaign?"** — body: "… has company-wide access. Blocking here removes them from this campaign only — access to other {company} campaigns is kept." Confirm button: **"Block on this campaign."**
- (2) Dialog titled **"Revoke company-wide access?"** — body mentions "across ALL campaigns of {company}." Confirm: **"Revoke company-wide."**
- (3) Dialog titled **"Revoke access?"** — plain single-campaign confirm.
- In every case, **Cancel** performs no request (watch the network tab / the grant stays); **Confirm** fires exactly one DELETE.

**Why it proves the fix.** Pre-fix, clicking the trash icon fired the DELETE **immediately with no confirmation and no explanation** — an admin could wipe company-wide access believing they were editing one campaign. The distinct copy per (view × source) makes the actual outcome explicit before anything happens.

**Regression checks.**
- `test_grant_and_revoke_access` (campaign-sourced) still returns 200 — unchanged contract, plus the new `removed` field.
- The company-wide revoke endpoint still fully clears the company grant (System-Admin-only).
- Frontend: the inline role dropdown and all existing Access-tab behavior are unaffected (only the revoke click path changed).

**Pitfalls.**
- The deny-override branch only triggers when an **active** (non-expired) company grant covers the user. If you test with an expired company grant, you'll get `removed: "campaign_grant"` — correct, because an expired grant confers nothing to block.
- Don't confuse the campaign endpoint's "block this campaign" with the company endpoint's "revoke company-wide" — they are different URLs with different gates. The whole point is they no longer bleed into each other.
- The frontend dialog is view-mode-aware: the **same** company-sourced row shows different copy in campaign view vs company view because the endpoint it will hit differs. That's intentional, not a bug.

---

### P64-C — Access-request endpoint is no longer a mail-bombing primitive

**What & why.** `POST /campaigns/{id}/access-requests` is public/unauthenticated and used to send **two** emails: an admin notification (fixed `admin_email`) and a "your request was received" confirmation to the **caller-supplied** address — which it never verified the caller owned. That made it a mail-amplification / email-bombing tool (loop a victim list → the site emails each). Fix: **(1)** no requester email on submit (the admin is still notified; the requester hears back only at approve/deny); **(2)** a dedicated tight rate limit (5/min + 20/day per IP) instead of the generic 60/min public limiter; **(3)** a `wpsg_access_request_precheck` filter for CAPTCHA/honeypot.

**Preconditions.** The mail-log mu-plugin from §1 installed (`tail -f wp-content/wpsg-mail.log`). A campaign ID `CID`.

#### Part 1 — no requester email on submit

**Steps.**
```bash
: > wp-content/wpsg-mail.log   # clear
curl -s -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/access-requests" \
  -H 'Content-Type: application/json' -d '{"email":"victim@example.com"}' | jq .
cat wp-content/wpsg-mail.log
```

**Expected (pass).** The 201 body reads *"Request submitted. You will receive an email once an administrator reviews it."* (not "check your email"). The mail log shows **one** line — `TO=<admin_email>` — and **no** line `TO=victim@example.com`.

**Why it proves the fix.** Pre-fix the log would show a second line to `victim@example.com`. The attacker-chosen recipient is gone; only the fixed admin address is ever mailed on submit.

**Then confirm the requester still hears back on resolution:**
```bash
: > wp-content/wpsg-mail.log
# Approve the pending request (as System Admin) via the admin UI or the approve endpoint, then:
cat wp-content/wpsg-mail.log   # → a line TO=victim@example.com (the approval notice)
```

#### Part 2 — dedicated rate limit (distinct from the 60/min public limiter)

**Steps.** Tighten just the access-request limit via a scratch mu-plugin: `add_filter('wpsg_rate_limit_access_request', fn() => 2);`. Then from one IP:
```bash
for i in 1 2 3; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/access-requests" \
    -H 'Content-Type: application/json' -d "{\"email\":\"user$i@example.com\"}"
done
```

**Expected (pass).** `201`, `201`, `429`. The 3rd trips at **2**, proving the limit is the dedicated `wpsg_access_request` bucket — not the generic 60/min public one (which is untouched by that filter).

#### Part 3 — the precheck seam

**Steps.** Add `add_filter('wpsg_access_request_precheck', '__return_false');` (simulating a failed CAPTCHA/honeypot), then submit once.

**Expected (pass).** `403` with code `wpsg_access_request_rejected`; the mail log stays empty and no request row is created (rejected before the handler runs). Returning a `WP_Error` from the filter (e.g. a real CAPTCHA integration) is surfaced verbatim with its own status/code.

**Regression checks.** With no filters set, a single legitimate submit still returns 201 with a token; duplicate-pending still 409; post-denial-within-24h still 429 (the cooldown, unaffected by the new limiter at low volume); approve still provisions the user and emails them.

**Pitfalls.**
- Viewing only the on-page 201 message proves nothing about the *email* — you must watch the mail log (or a real inbox) to confirm the requester address isn't mailed.
- The dedicated limiter, like all P63 rate limiting, only persists across requests on a host with a real object cache **or** via the transient fallback — default wp-env uses the transient path (works). Keep the source IP constant across the three requests.
- The daily 20/IP bucket and the 5/min bucket are separate; a burst test trips the minute bucket first. Don't set both filters to tiny values at once or you'll conflate them.

---

### P64-D — Approved first-time requesters can actually log in

**What & why.** `do_approve_request()` provisions a missing user with `wp_create_user($username, wp_generate_password(), $email)` — a password nobody knows — and emailed only "your access was approved, visit the site." A first-time visitor then hit a login form they could never pass. Fix: call `wp_new_user_notification($user_id, null, 'user')` (a password-set/reset link, not the password) for **newly created** users, mirroring the admin `create_user` path. Existing users are untouched (no spurious reset email).

**Preconditions.** Mail log from §1. A pending access request for a **brand-new** email (one with no WP user).

**Steps.**
```bash
: > wp-content/wpsg-mail.log
# Approve the pending request as System Admin (admin UI, or the approve endpoint).
cat wp-content/wpsg-mail.log
```

**Expected (pass).** **Two** emails to the requester: the "Access Approved" notice *and* a password-set notification (WordPress's "[SiteName] Login Details" / password-reset link). Following that reset link lets the new user set a password and log in.

**Then the existing-user case:** approve a request for an email that **already** has a WP account → only the "Access Approved" email; **no** password-reset notification (they already have credentials).

**Why it proves the fix.** Pre-fix the mail log showed only the "approved" notice for a new user — no way to obtain a password. The reset-link email is the missing piece.

**Regression checks.** Automated `WPSG_P64DEF_Auth_Correctness_Test` pins both branches (notification fires for a new email, not for an existing user) via the `wp_new_user_notification_email` hook.

**Pitfalls.** wp-env has no real MTA — use the mail log or a catcher; a bare "it didn't error" tells you nothing about which emails were attempted. The notification is a *reset link*, never the plaintext password.

---

### P64-E — Magic-link fallback page renders real HTML (not escaped JSON)

**What & why.** With no landing page configured, `magic_link_redirect()` returned a `WP_REST_Response` whose *data* was an HTML string. `WP_REST_Server::serve_request()` JSON-encodes response data, so the browser got a quoted, backslash-escaped blob under `Content-Type: text/html` — a visibly broken page. Fix: echo the HTML raw through a one-shot `rest_pre_serve_request` filter (data is now `null`), the same pattern the audit-CSV export uses.

**Preconditions.** Ensure **no** magic-link landing page is set: `wpsg_settings['magic_link_landing_page_id']` unset/0 (Settings → the magic-link landing page selector empty). A pending request with a valid magic key (captured from the admin notification email's one-click link), or just any magic-approve URL to hit the invalid/expired fallback.

**Steps.** Open a magic-approve URL **in a browser** (or `curl`), e.g. the one-click link from the admin email, or a deliberately-invalid one to see the "Invalid Link" card:
```bash
curl -s "$BASE/wp-json/wp-super-gallery/v1/campaigns/<CID>/access-requests/<TOKEN>/magic-approve?magic_key=deadbeef" | head -c 120; echo
```

**Expected (pass).** The response body **starts with `<!DOCTYPE html>`** and is a normal styled result card in the browser — **not** a string that begins with `"<!DOCTYPE` or shows literal `\/` and escaped quotes.

**Why it proves the fix.** Pre-fix the body was a JSON-encoded string (leading `"`, `\"` around every attribute, `\/` in `</…>`), which browsers render as garbled text. Raw `<!DOCTYPE …>` proves the JSON encoder is bypassed.

**Regression checks.** With a landing page **configured**, the magic link still 302-redirects to that page with `?wpsg_result=…` (unchanged). `WPSG_P28I_Magic_Link_Test` stays green. Automated `WPSG_P64DEF_Auth_Correctness_Test` asserts the response data is `null` and the serve filter echoes raw `<!DOCTYPE` with no `\/` escaping.

**Pitfalls.** `rest_do_request()` (used by unit tests) does **not** run `rest_pre_serve_request`, so the raw echo only happens on a real HTTP request — test it with an actual browser/curl request, not a REST-internal call. The redirect branch (landing page set) never had the bug; to see the fallback you must clear the landing page.

---

### P64-F — `create_user` mail-failure fallback actually triggers

**What & why.** The reset-URL fallback in `create_user()` (returned to the client so an admin can still onboard the user when mail is down) was gated on a `try/catch (Exception)` around `wp_new_user_notification()`. But `wp_mail()` catches PHPMailer exceptions internally and returns `false` — it never throws — so `$email_sent` was always `true` and the fallback was dead code. Fix: listen for `wp_mail_failed` around the call.

**Preconditions.** System Admin. A way to force a mail failure — e.g. a scratch mu-plugin that makes `wp_mail` fail the way a real SMTP error does:
```php
add_filter('pre_wp_mail', function ($short) {
    do_action('wp_mail_failed', new WP_Error('forced', 'forced failure'));
    return false; // report failure
}, 10, 1);
```

**Steps.** With that filter active, create a user via the admin "Quick add user" flow (or `POST /users`), then inspect the response.

**Expected (pass).** The 201 response has `emailSent: false`, `emailFailed: true`, and a `resetUrl` the admin can hand to the user. Without the filter (mail succeeds), `emailSent: true` and **no** `resetUrl`.

**Why it proves the fix.** Pre-fix, even with mail forced to fail, `emailSent` came back `true` and no `resetUrl` was produced — the admin had no recovery path. Now the failure is detected and the fallback link appears.

**Regression checks.** Automated `WPSG_P64DEF_Auth_Correctness_Test` covers both the failure path (emailSent=false + resetUrl present) and the success path (emailSent=true, no resetUrl).

**Pitfalls.** A `pre_wp_mail` short-circuit that *doesn't* also fire `wp_mail_failed` is a deliberate "mail suppressed" override, not a failure — the fix (correctly) only reacts to `wp_mail_failed`. Simulate the real failure signal, as the snippet above does.

---

### P64-G — Space-level revoke is confirmed before it fires

**What & why.** `SpaceManagementView`'s per-grant trash icon called the DELETE immediately on click — no confirmation. This is the same gap P64-B closed for the campaign/company Access tab, on a separate surface. Fix: a plain confirm dialog (space access has no campaign/company duality, so no branching copy) before the revoke fires.

**Preconditions.** Admin SPA → WP Super Gallery → **Spaces** → pick a space with at least one access grant → **Access** tab.

**Steps.** Click the red trash icon on a grant row.

**Expected (pass).** A dialog titled **"Revoke space access?"** — body "Revoke access to this space for {name}?" — with **Revoke** / **Cancel**. **Cancel** makes no request (the grant stays); **Revoke** fires exactly one `DELETE /spaces/{id}/access/{userId}` and the row disappears.

**Why it proves the fix.** Pre-fix the click fired the DELETE with no chance to reconsider. The dialog interposes a confirmation.

**Regression checks.** Automated `SpaceManagementView.test.tsx` (P64-G block): dialog-opens-on-click / no immediate DELETE, cancel does nothing, confirm calls DELETE with the right URL. The inline role dropdown and other Access-tab behavior are unaffected.

**Pitfalls.** This is a distinct code path from P64-B's `useAccessRows` dialog — they share the pattern, not the component. Testing one doesn't cover the other.

---

## 5. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P64-A | Full suite green after the refactor; `WPSG_Grants` unit tests pass | Zero private `upsert_*`/inline expiry copies remain; grant matrix unchanged | ☐ |
| P64-B | Company-sourced campaign revoke → deny override, company grant kept; space editor can't wipe company grants | Campaign-sourced revoke unchanged; company-wide endpoint still clears the grant; confirm dialog copy correct per view×source | ☐ |
| P64-C | Submit emails only the admin, never the requester; dedicated 5/min limit trips; precheck rejects | Duplicate 409 / cooldown 429 / approve-notifies still work | ☐ |
| P64-D | New-email approval sends a password-set notification | Existing-user approval sends none | ☐ |
| P64-E | Fallback body starts with raw `<!DOCTYPE html>` | Landing-page redirect branch unchanged; magic-link suite green | ☐ |
| P64-F | Forced mail failure → `emailSent:false` + `resetUrl` | Successful send → `emailSent:true`, no `resetUrl` | ☐ |
| P64-G | Space revoke shows a confirm dialog; DELETE only on confirm | Cancel makes no request; role dropdown unaffected | ☐ |

**Automated baseline (must be green alongside manual QA):** full wp-env PHPUnit suite plus the frontend Vitest suite. See PHASE64_REPORT.md → each track's *Implementation* block for the exact per-track counts.
