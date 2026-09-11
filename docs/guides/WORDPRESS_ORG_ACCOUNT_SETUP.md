# WordPress.org Account Setup

A human-gate walkthrough for [P76-C](../archive/phases/PHASE76_REPORT.md#track-p76-c---wordpressorg-contributors-handle):
the plugin cannot be submitted to the directory, and `readme.txt`'s `Contributors:`
field cannot be fixed, until a live WordPress.org account exists. This is not
code — nobody else can do this step for you.

Verified 2026-08-29 against WordPress.org's own documentation (linked throughout),
not general knowledge — two things here have changed recently and are easy to
get wrong from older tutorials: 2FA is now mandatory, and SVN uses its own
separate password.

---

## Choosing the account (read this before registering)

**Register a brand/account identity, not a `mullion-gallery`-specific one — and
use one account for every plugin, not one account per plugin.** This is what
WordPress.org itself expects, not just a convenience:

- Its own contributor guidance states plainly that **all plugins owned by the
  same company/team/entity must be under the same account** — a separate
  account per product isn't the neutral choice, it goes against how the
  directory is meant to be used.
- The SVN password (below) is **account-wide**: one password grants commit
  access to everything that account can commit to. One account per plugin
  means one 2FA setup and one SVN credential to manage — and rotate in CI
  secrets — *per plugin*, for no real isolation benefit.
- The account's public profile page (`profiles.wordpress.org/<username>/`)
  lists every plugin it contributes to. That's a portfolio, and splitting it
  across accounts dilutes it for no benefit.
- Trade-off worth knowing: a company/brand-style account **cannot participate
  in the support forums** under that identity — forum support needs an
  individually-identified human account, added separately as a Support Rep.
  If you expect to personally answer forum threads, you may want your own
  personal account *in addition to* the brand account, listed as an extra
  `Contributors:` entry — not instead of it.

None of this picks the actual username for you — that's still your call (see
[Key Decision E](../archive/phases/PHASE76_REPORT.md#key-decisions)) — just: pick something
that scales past this one plugin.

Two data points from checking live profiles, not assumptions:

| Candidate | Status |
|---|---|
| `mullion` | **Taken** — unrelated account since 2010, 0 plugin contributions |
| `mulliongallery` | Available |
| `wpsupergallery` (the string currently in `readme.txt`) | **Does not exist** — a 404, not a real account. It was never a valid handle, on top of being off-brand. |

---

## Step-by-step

### 1. Register

[login.wordpress.org/register](https://login.wordpress.org/register) — username,
email, accept the privacy policy, submit. Verification email can take
"a few hours to a couple of days" per WordPress.org's own onboarding docs;
nothing below works until it clears.

### 2. Enable Two-Factor Authentication

> **Not optional, and not in the original phase plan.** Since **October 1,
> 2024**, WordPress.org requires 2FA on any account with plugin commit access.
> Do this now, before submitting, so it isn't a surprise blocking you later.

`profiles.wordpress.org/me/profile/security` → set up 2FA → **save the backup
codes somewhere durable.** WordPress.org's own advisory warns that losing both
the 2FA method and the backup codes can make the account very hard to recover.

### 3. Generate the SVN password

> **This is what [`svn-deploy.yml`](../../.github/workflows/svn-deploy.yml)
> actually needs**, and it is *not* the account password. Because SVN auth
> can't carry 2FA, WordPress.org splits commit access into its own
> separate, randomly-generated credential — your login password stays
> 2FA-protected and is never used for SVN.

`profiles.wordpress.org/me/profile/edit/` → **Account & Security** tab →
**SVN Password** → Generate. It's a high-entropy string you can't choose;
regenerating it invalidates the previous one, which is what you'd do to
rotate the CI secret later.

**This value — not the login password — is what goes into the
`SVN_USERNAME` / `SVN_PASSWORD` GitHub repository secrets.**

### 4. Submit the plugin

[wordpress.org/plugins/developers/add/](https://wordpress.org/plugins/developers/add/),
logged in. Upload a ZIP; Plugin Check runs automatically; a slug is proposed
from the plugin's `Plugin Name` header.

> **Gotcha specific to this repo.** [`mullion-gallery.php`](../../wp-plugin/mullion-gallery/mullion-gallery.php)'s
> header reads `Plugin Name: Mullion`, not "Mullion Gallery." WordPress.org
> will propose a slug sanitized from *that* — almost certainly `mullion` —
> not `mullion-gallery`. But the SVN `SLUG:` in `svn-deploy.yml`, the
> `Text Domain`, every `languages/mullion-gallery-*` catalog file, and the
> POT `X-Domain` are all hardcoded to `mullion-gallery`. Accepting the
> proposed slug as-is breaks that alignment.
>
> **Fix:** the submission flow lets you edit the proposed slug once, before
> review starts — an automated email spells out how. Change it to
> `mullion-gallery` there. If that window closes first, the only remaining
> fix pre-approval is emailing `plugins@wordpress.org` directly. **The slug
> cannot be changed at all once the plugin is approved.**

### 5. Review

WordPress.org states **1–10 days**, aiming for 5 business days. Plugin Check
must pass — already tracked as its own item in
[GO_LIVE_PUNCH_LIST.md](GO_LIVE_PUNCH_LIST.md) §F.

### 6. On approval

The submitting account becomes the plugin's initial **Committer**
automatically, and the SVN repo is created at
`https://plugins.svn.wordpress.org/mullion-gallery/` — assuming step 4's slug
landed correctly. That Committer role is the permission `svn-deploy.yml`
actually depends on.

---

## What this hands back to the code (P76-C)

Once the username resolves at `https://profiles.wordpress.org/<username>/`:

- [`readme.txt`](../../wp-plugin/mullion-gallery/readme.txt) line 2:
  `Contributors: wpsupergallery` → `Contributors: <username>`.
- GitHub repo secrets `SVN_USERNAME` / `SVN_PASSWORD`, using the **SVN
  password from step 3**, not the account login password.

---

## Sources

- [Subversion Access – Make WordPress.org](https://make.wordpress.org/meta/handbook/tutorials-guides/svn-access/)
- [Upcoming Security Changes for Plugin and Theme Authors – Make WordPress Plugins](https://make.wordpress.org/plugins/2024/09/04/upcoming-security-changes-for-plugin-and-theme-authors-on-wordpress-org/)
- [Add your Plugin | WordPress.org](https://wordpress.org/plugins/developers/add/)
- [Detailed Plugin Guidelines – Plugin Handbook](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)
- [Creating a WordPress.org Account | Learn WordPress](https://learn.wordpress.org/lesson-plan/creating-a-wordpress-org-account/)
- [Plugin Readmes – Plugin Handbook](https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/)
