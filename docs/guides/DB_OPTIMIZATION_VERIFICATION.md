# Database Optimization Verification Guide

This guide outlines how to verify Phase 8 database optimizations and measure impact.

---

## Scope

- Indexes on `postmeta` and `termmeta`
- Access‑grant query optimization (bulk meta load)
- Pagination support for large datasets

---

## 1) Verify Indexes

### What to check
- `postmeta` index: `wpsg_postmeta_postid_key (post_id, meta_key)`
- `termmeta` index: `wpsg_termmeta_termid_key (term_id, meta_key)`

### Expected outcome
Indexes exist and are used by queries filtering on `post_id` + `meta_key` or `term_id` + `meta_key`.

### How to verify (SQL)
Run in your DB client:

```
SHOW INDEX FROM wp_postmeta WHERE Key_name IN ('wpsg_postmeta_postid_key');
SHOW INDEX FROM wp_termmeta WHERE Key_name IN ('wpsg_termmeta_termid_key');
```

---

## 2) Access‑Grant Query Optimization

### What to check
Endpoint: `GET /wp-json/wp-super-gallery/v1/companies/{id}/access?include_campaigns=true`

### Expected outcome
- Fewer DB queries vs previous implementation (no per‑campaign `get_post_meta` calls).
- Similar or faster response time.

### How to verify
- Install Query Monitor plugin.
- Hit the endpoint with include_campaigns.
- Compare query count and total DB time before/after optimization.

---

## 3) Pagination Support

### What to check
Endpoint: `GET /wp-json/wp-super-gallery/v1/companies?page=1&per_page=50`

### Expected outcome
- Response includes `X-WPSG-Total`, `X-WPSG-Page`, `X-WPSG-Per-Page` headers.
- Results are correctly paginated.

---

## 4) Regression Checks

- Access grants still return correct `campaignTitle` and `campaignStatus`.
- Company access list includes both company and campaign grants.
- Admin UI lists behave as expected with pagination headers.

---

## 5) Slow Query Logging

### What to check
Slow REST logs are emitted when requests exceed the threshold.

### How to verify
1. Set a low threshold via filter:
	- `add_filter('wpsg_slow_query_threshold_ms', fn() => 1);`
2. Call `/campaigns`, `/campaigns/{id}/media`, and `/companies/{id}/access?include_campaigns=true`.
3. Confirm logs in PHP error log contain `"[WPSG] Slow REST"` entries.

---

## 6) Archive Cleanup Strategy

### What to check
Archived campaigns older than the retention window are deleted by daily cron.

### How to verify
1. Set retention days via filter:
	- `add_filter('wpsg_archive_retention_days', fn() => 1);`
2. Create a campaign, set status to archived, and backdate it beyond 1 day.
3. Run the cron hook manually:
	- `do_action('wpsg_archive_cleanup');`
4. Confirm the archived campaign is deleted.

---

## Notes

- If indexes are already present (e.g., from host tuning), migration will skip creation.
- For performance baselines, capture Query Monitor output for the endpoint before and after optimizations.
