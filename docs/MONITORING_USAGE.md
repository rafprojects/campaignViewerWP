# Monitoring Usage Guide (Web Vitals + Sentry)

This document explains **why** we capture performance and error signals, and **how** to configure and verify them during development and production.

---

## Purpose

### Web Vitals
Web Vitals provide real‑user performance indicators for page load and interaction quality. We capture:

- **LCP** (Largest Contentful Paint): load performance
- **CLS** (Cumulative Layout Shift): visual stability
- **INP** (Interaction to Next Paint): interaction responsiveness
- **FID** (First Input Delay): legacy responsiveness fallback

These metrics help validate Core Web Vitals targets for Phase 8 and identify regressions.

### Sentry
Sentry provides error tracking and stack traces in production. It helps:

- detect runtime errors with context
- track regressions across releases
- measure stability over time

---

## Web Vitals: Usage

### Where it runs
Startup hook: [src/main.tsx](../src/main.tsx) calls `startWebVitalsMonitoring()`.

### What it does
- Observes PerformanceObserver entries for LCP/CLS/INP/FID
- Buffers metrics in memory
- Exposes captured metrics on `window.__WPSG_VITALS__`
- Logs to console for quick validation

### How to verify locally
1. Open the app in the browser.
2. Interact and navigate normally.
3. Check console logs tagged with `[WPSG][Vitals]`.
4. Inspect `window.__WPSG_VITALS__` in DevTools.

### Sampling
Default sampling rate is 100%. If sampling is needed later, update `startWebVitalsMonitoring({ sampleRate: 0.1 })`.

---

## Sentry: Usage

### Where it runs
Startup hook: [src/main.tsx](../src/main.tsx) calls `initSentry({ dsn })`.

### How it is configured
- Sentry only initializes when a DSN is provided.
- DSN can be injected from WordPress with the filter below:

```php
add_filter('wpsg_sentry_dsn', function () {
  return 'https://examplePublicKey@o0.ingest.sentry.io/0';
});
```

### Environment rules
- Sentry is **disabled** in dev builds (`import.meta.env.DEV`).
- Sentry is **enabled** in production builds when DSN is set.

### How to verify
1. Set the `wpsg_sentry_dsn` filter in WP.
2. Trigger a deliberate error in production build.
3. Confirm the event arrives in your Sentry project.

### Server-side alerts
WPSG will also send critical alert events (fatal errors and REST error spikes) to Sentry when the PHP SDK is installed.

### DSN exposure note
Sentry DSNs are public and typically exposed in frontend apps. To mitigate abuse, configure Sentry **Allowed Domains** and consider lowering sample rates. If you need stronger control, route events through a backend proxy.

---

## Alerts (Admin Email)

### What it does
- Sends email on fatal PHP errors for WPSG REST requests.
- Sends email when REST errors (>=500) exceed a threshold in a time window.

### Defaults
- Threshold: 5 errors in 10 minutes.
- Throttle: 10 minutes between alert emails.
- Recipient: WordPress admin email.

### Configuration (WP Filters)
```php
add_filter('wpsg_alert_email_enabled', fn() => true);
add_filter('wpsg_alert_email_recipient', fn() => 'ops@example.com');
add_filter('wpsg_alert_error_threshold', fn() => 5);
add_filter('wpsg_alert_rate_window_minutes', fn() => 10);
add_filter('wpsg_alert_throttle_minutes', fn() => 10);
```

---

## Related Files

- Web Vitals implementation: [src/services/monitoring/webVitals.ts](../src/services/monitoring/webVitals.ts)
- Sentry initialization: [src/services/monitoring/sentry.ts](../src/services/monitoring/sentry.ts)
- Bootstrap wiring: [src/main.tsx](../src/main.tsx)
- WP config injection: [wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php)

---

## Notes

- Current Web Vitals reporting is in‑memory + console only. If needed, add a backend endpoint and wire `report()` to POST metrics.
- Sentry traces are configured with a conservative sample rate. Adjust in `initSentry()` if needed.
