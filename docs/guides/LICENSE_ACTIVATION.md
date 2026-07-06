# WP Super Gallery — License Activation & Pro Features

A buyer-facing guide to activating your Pro license, understanding what it unlocks,
and troubleshooting activation. For installation and general troubleshooting see
[INSTALL_AND_TROUBLESHOOTING.md](INSTALL_AND_TROUBLESHOOTING.md).

> **Note:** Licensing, checkout, and updates are handled by **Freemius** (our merchant
> of record). The exact screens below reflect the standard Freemius flow; final
> screenshots and the definitive support/refund details will be confirmed with the
> live product listing.

---

## What Pro unlocks

The core gallery and the visual LayoutBuilder are **free and fully functional**. A Pro
license unlocks these advanced LayoutBuilder capabilities:

| Feature | What it does |
|---|---|
| **Text layers** | Add and edit rich text layers directly on a layout. |
| **Per-breakpoint responsive editing** | Fine-tune slot position/size independently for tablet and mobile. |
| **Starter template library** | Start a new layout from a curated preset instead of a blank canvas. |

When you are not licensed, these entry points stay visible but show a clear **"Pro
feature"** prompt with an upgrade link instead of activating — nothing breaks, and the
rest of the builder works normally.

---

## Activating your license

1. Purchase a plan (see the pricing page linked from the plugin or the store listing).
   You'll receive a **license key** by email.
2. In WordPress admin, open the plugin's **licensing screen** (added by the Freemius SDK,
   typically under the WP Super Gallery menu or the Plugins page **Account / License** link).
3. Paste your **license key** and click **Activate**.
4. The Pro features unlock immediately — no page rebuild required. Reload any open
   LayoutBuilder tab if it was open during activation.

### Trials

If a free trial is offered, starting it activates Pro for the trial period. When the trial
ends without a purchase, the site returns to the free tier (see "What happens when a
license ends" below).

### Analytics / usage data

Freemius may ask, during activation, whether to share anonymous usage data. This is
**opt-in** — you can skip it and the plugin still works fully. Nothing is transmitted
before you make that choice.

---

## Deactivating / moving to another site

Your plan covers a set number of sites (single / 5-site / agency). To move a license to a
different site, **deactivate** it on the current site first (same licensing screen →
**Deactivate**), then activate it on the new site. This frees the seat.

## What happens when a license ends (or is deactivated)

- **Your saved content is never deleted or broken.** Layouts that already contain text
  layers or per-breakpoint overrides continue to render exactly as before.
- Only **new or edited** Pro content is gated: while unlicensed you cannot add new text
  layers, switch into tablet/mobile edit mode, or open the starter library. Attempting to
  edit an existing Pro field simply leaves the last-saved value in place.
- Re-activating a license restores full editing immediately.

---

## Automatic updates

With an active license, plugin updates (including Pro builds) are delivered securely
through Freemius and appear in the normal WordPress **Plugins → Updates** flow. No manual
download is required.

---

## Troubleshooting

| Symptom | What to check |
|---|---|
| "Invalid license key" | Re-copy the key from your purchase email (no leading/trailing spaces). Confirm you're activating the same product you purchased. |
| Key activates but Pro stays locked | Reload the page / any open LayoutBuilder tab. Confirm the licensing screen shows the license as **active** and not expired. |
| "No available activations" / seat limit | Deactivate the license on a site you no longer use, or upgrade to a higher-seat plan. |
| Updates not appearing | Confirm the license is active; check **Plugins → Updates**. Update delivery requires outbound HTTPS from your server to Freemius. |
| Everything looks locked after it worked before | Your license may have expired or been deactivated — see "What happens when a license ends" above. Your saved content is safe. |

Still stuck? Contact support at **[PLACEHOLDER: support email, e.g. support@yourdomain.tld]**.
When reporting an issue, include your WordPress version, PHP version, the plugin version,
and (if relevant) your license/order reference.

---

## Refunds

[PLACEHOLDER: refund policy — e.g. "14-day money-back guarantee; contact support within 14
days of purchase for a full refund."] Refunds are processed through Freemius.
