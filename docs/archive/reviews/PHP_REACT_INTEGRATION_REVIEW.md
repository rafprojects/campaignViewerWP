# PHP ↔ React Integration Review

**Date:** 2026-03-18  
**Scope:** Data contract integrity between the WordPress PHP backend and the React frontend, REST payload shape consistency, and meaningful performance improvements.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Confirmed Issues](#2-confirmed-issues)
3. [Potential Issues](#3-potential-issues)
4. [Performance Improvements](#4-performance-improvements)
5. [Actionable Task List](#5-actionable-task-list)

---

## 1. Architecture Overview

### Data Flow

```
WordPress (PHP)                          React (TypeScript)
─────────────────                        ──────────────────
wp_options (settings)  ───JSON──────▶    apiClient.ts
CPT wpsg_campaign      ──REST API──▶    useAdminSWR.ts (SWR hooks)
Custom tables           ──/wp-json/─▶    useUnifiedCampaignModal.ts
Taxonomies (company,                     AuthContext.tsx
  tags, categories)                      WpJwtProvider.ts
```

### Naming Convention Handling

| Direction | Mechanism | Coverage |
|-----------|-----------|----------|
| Settings: PHP → React | `WPSG_Settings::to_js()` — automatic snake→camel | Full (200+ fields) |
| Settings: React → PHP | `WPSG_Settings::from_js()` — automatic camel→snake | Full |
| Campaigns: PHP → React | `format_campaign()` — hardcoded field mapping | Full (all campaign fields) |
| Campaigns: React → PHP | `apply_campaign_meta()` — reads camelCase params, writes snake_case meta | Full |
| Analytics/Access Requests | **No conversion layer** — PHP returns snake_case, React types mirror it | **Inconsistent** |

### Response Shape Patterns

PHP uses two patterns for list endpoints:
- **Wrapped:** `{ items: [...], total: N, page: N }` — campaigns, media
- **Bare array:** `[...]` — access grants, companies, audit entries, access requests, tags

The frontend's `normalizeListResponse()` handles both via its `Array.isArray()` first-check, so this works today — but the inconsistency makes the API harder to reason about and extend (e.g., adding pagination to a bare-array endpoint would be a breaking change).

---

## 2. Confirmed Issues

### 2A. Five List Endpoints Return Bare Arrays Instead of Object-Wrapped Responses

**Severity:** Medium — functional today, but fragile contract  
**Decision:** Wrap all five in `{ items: [...] }` for consistency and extensibility

| # | Endpoint | PHP Method | Current Shape | File |
|---|----------|-----------|---------------|------|
| 1 | `GET /campaigns/{id}/access` | `list_access()` | `[...grants]` | class-wpsg-rest.php |
| 2 | `GET /companies/{id}/access` | `list_company_access()` | `[...grants]` | class-wpsg-rest.php |
| 3 | `GET /companies` | `list_companies()` | `[...companies]` | class-wpsg-rest.php |
| 4 | `GET /campaigns/{id}/access-requests` | `list_access_requests()` | `[...requests]` | class-wpsg-rest.php |
| 5 | `GET /campaigns/{id}/audit` | `list_audit()` | `[...entries]` | class-wpsg-rest.php |

**Impact on React:** The frontend's `normalizeListResponse()` in `useAdminSWR.ts` catches bare arrays first (`if (Array.isArray(response)) return response`), then checks `.items`, `.entries`, etc. After wrapping, the `.items` path will be used and the `Array.isArray` branch becomes dead code for these endpoints (can be kept for safety).

**PHP change per endpoint:** Wrap the return value:
```php
// Before:
return new WP_REST_Response($enriched, 200);
// After:
return new WP_REST_Response(['items' => $enriched], 200);
```

**React change:** `useCompanies` directly assigns `data ?? []` — update to `data?.items ?? []`. The other four already go through `normalizeListResponse` which handles `.items`.

---

### 2B. snake_case Inconsistency in Two Response Types

**Severity:** Medium — breaks naming convention, complicates frontend code  
**Decision:** Convert to camelCase for full consistency

#### Analytics Response (`GET /analytics/campaigns/{id}`)

PHP returns (`class-wpsg-rest.php` ~line 1365):
```php
'total_views'      => (int) $total_views,
'unique_visitors'  => $total_unique,
```

Must become:
```php
'totalViews'       => (int) $total_views,
'uniqueVisitors'   => $total_unique,
```

**Files to update:**
- `class-wpsg-rest.php` — response keys in `get_campaign_analytics()` (~line 1365-1366)
- `src/services/apiClient.ts` — `CampaignAnalyticsResponse` interface (~line 568-569)
- `src/components/Admin/AnalyticsDashboard.tsx` — references `data?.total_views`, `data?.unique_visitors` (~line 138, 143)
- `src/components/Admin/AnalyticsDashboard.test.tsx` — mock data (~line 22-23, 83)
- `wp-plugin/.../tests/WPSG_REST_Extended_Test.php` — assertion (~line 234)

#### Access Request Response (`GET /campaigns/{id}/access-requests`)

PHP returns (`class-wpsg-rest.php` `format_access_request()` ~line 1732):
```php
'campaign_id'  => (int) $row['campaign_id'],
'requested_at' => gmdate('c', strtotime($row['requested_at'])),
'resolved_at'  => ...
```

Must become:
```php
'campaignId'   => (int) $row['campaign_id'],
'requestedAt'  => gmdate('c', strtotime($row['requested_at'])),
'resolvedAt'   => ...
```

**Files to update:**
- `class-wpsg-rest.php` — `format_access_request()` (~line 1732-1740), response keys only (DB column names stay snake_case)
- `src/services/apiClient.ts` — `AccessRequest` interface (~line 593-596)
- `src/components/Admin/PendingRequestsPanel.tsx` — references `req.requested_at`, `req.resolved_at` (~line 136, 204)
- `src/components/Admin/PendingRequestsPanel.test.tsx` — mock data (~line 18-21, 27-30)

#### Analytics Event Request Body (`POST /analytics/event`)

React currently sends `{ campaign_id, event_type }` (snake_case) in `apiClient.ts` (~line 259). PHP reads `$request->get_param('campaign_id')` (~line 1271).

Must become `{ campaignId, eventType }` on React side. PHP handler `record_analytics_event()` must read `campaignId` and `eventType` instead.

**Files to update:**
- `src/services/apiClient.ts` — `recordAnalyticsEvent()` request body (~line 258-260)
- `class-wpsg-rest.php` — `record_analytics_event()` param reads (~line 1271-1272)

---

### 2C. Tag/Category Error Responses Return Empty Array Instead of Object

**Severity:** Low — only triggers on `get_terms()` WP_Error (rare)

PHP `list_campaign_tags()` and `list_media_tags()` return `new WP_REST_Response([], 200)` on error. While these are list endpoints (so `[]` is semantically correct for "no items"), wrapping them for consistency with Decision 2A is a minor addition.

Since these are also list endpoints, they should follow the same `{ items: [...] }` wrapping pattern.

**Files to update:**
- `class-wpsg-rest.php` — `list_campaign_tags()` (~line 4168 error case + ~line 4171 result), `list_media_tags()` (~line 4192 error case + ~line 4195 result)

---

## 3. Potential Issues

### 3A. Nonce Expiry with No Automatic Retry

**Severity:** Low-Medium — affects long-lived admin sessions  
**Current state:** `useNonceHeartbeat` refreshes the nonce every 20 minutes. WP nonces are valid for 24 hours (two tick periods of 12h each). The heartbeat is well within that window, so this is safe in practice.

**Edge case:** If the heartbeat fetch itself fails (network blip, server restart), the nonce goes stale. There is no retry-after-401 mechanism — the next API call will fail with a 403 and the user must refresh the page.

**Recommendation:** Add a single-retry on 403 that fetches a new nonce from `/nonce`, updates globals, and replays the original request. This would be implemented in `apiClient.ts`'s `handleResponse()` method.

---

### 3B. `mergeSettingsWithDefaults` Drops Unknown Server Fields

**Severity:** Low  
**Current state:** The merge function iterates only over keys in `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`. New server-side settings added to PHP but not yet added to the React defaults constant will be silently ignored.

**Impact:** When a new setting is added to PHP, it must also be added to the React defaults otherwise it won't propagate, even if the API returns it. This is by-design (explicit contract), but undocumented.

**Recommendation:** No code change needed — just document this in the settings development workflow: "When adding a new setting to `WPSG_Settings::$defaults`, also add it to `DEFAULT_GALLERY_BEHAVIOR_SETTINGS` in the React app."

---

### 3C. `typographyOverrides` Silent JSON Parse Failure

**Severity:** Low  
**Current state:** PHP stores `typography_overrides` as a serialized value. `mergeSettingsWithDefaults.ts` parses it with a try/catch and silently falls back to default on failure.

**Recommendation:** Add a `console.warn` in the catch block to make this debuggable without breaking production.

---

### 3D. `copy_media` Request-Body Field in Duplicate Campaign

**Severity:** Low  
**Location:** `apiClient.ts` `duplicateCampaign()` sends `{ name?, copy_media }`. PHP reads `$request->get_param('copy_media')`.

This is a snake_case field in an outbound request body. For full consistency (per Decision 2B), this should become `copyMedia` with a corresponding PHP change. However, this is a single field on a single endpoint, so it can be addressed during the broader snake_case cleanup.

---

## 4. Performance Improvements

### 4A. N+1 Meta Queries in `list_campaigns` with `include_media=true`

**Impact:** HIGH — 20+ extra DB queries on a typical campaign listing page  
**Decision:** Use WordPress `update_meta_cache()` to prime the object cache

When `include_media=true`, the campaign listing loops through results and calls `get_post_meta($post->ID, 'media_items', true)` per campaign. Each call is an individual DB query unless the meta cache is primed.

**Fix:** Before the loop, call:
```php
$post_ids = wp_list_pluck($query->posts, 'ID');
update_meta_cache('post', $post_ids);
```
This executes a single `SELECT * FROM wp_postmeta WHERE post_id IN (...)` query and populates WP's object cache. All subsequent `get_post_meta()` calls become cache hits with zero DB overhead.

**Estimated improvement:** From N+1 queries (potentially 20-50 for a loaded admin page) down to 1 batch query. This is the highest-leverage change in the entire review.

**File:** `class-wpsg-rest.php`, `list_campaigns()` method — add ~3 lines before the media enrichment loop.

---

### 4B. N+1 Meta + Term Queries in `list_companies`

**Impact:** MEDIUM — N extra queries for campaign status lookups + N term relationship lookups

The `list_companies()` method:
1. Fetches all campaigns via `get_posts()` 
2. Loops through them calling `get_post_meta($campaign->ID, 'status', true)` per campaign
3. Calls `wp_get_object_terms($campaign->ID, 'wpsg_company', ...)` per campaign

**Fix:** Same approach — prime meta cache once with `update_meta_cache('post', $campaign_ids)` before the loop. For term relationships, call `update_object_term_cache($campaign_ids, 'wpsg_company')` to batch-load all term assignments.

**File:** `class-wpsg-rest.php`, `list_companies()` method.

---

### 4C. Add Transient Caching to `list_companies`

**Impact:** MEDIUM — companies list rarely changes but is fetched on every admin panel load

`list_campaigns()` already uses transient caching (5-minute TTL, invalidated by `wpsg_cache_version`). The same pattern should be applied to `list_companies()`, which currently queries the database on every request despite company data changing infrequently.

**File:** `class-wpsg-rest.php`, `list_companies()` — wrap the query in a `get_transient()` / `set_transient()` pattern using the existing `wpsg_cache_version` key for invalidation.

---

### 4D. Batch Prefetch Concurrency Increase

**Impact:** LOW-MEDIUM — faster admin panel initial load

The prefetch functions (`prefetchAllCampaignAccess`, `prefetchAllCampaignAudit`, `prefetchAllCampaignMedia`) currently use a concurrency of 4 with 100-150ms stagger. Modern browsers support 6 concurrent connections per host (HTTP/1.1) or unlimited with HTTP/2.

**Recommendation:** Increase `PREFETCH_CONCURRENCY` from 4 to 6, and reduce stagger from 100ms to 50ms for access/audit (small payloads). Keep 150ms for media (larger payloads).

**File:** `src/hooks/useAdminSWR.ts`, constants near the prefetch functions.

---

## 5. Actionable Task List

Each task is self-contained and can be implemented independently. Tasks are ordered by priority.

---

### TASK 1: Prime WP meta cache before campaign listing media loop

**Priority:** High  
**Type:** Performance  
**Ref:** Section 4A

In `class-wpsg-rest.php`, in the `list_campaigns()` method, immediately before the `foreach` loop that calls `get_post_meta($post->ID, 'media_items', true)` per campaign (approximately line 842), add a batch meta cache prime:

```php
$post_ids = wp_list_pluck($query->posts, 'ID');
update_meta_cache('post', $post_ids);
```

This converts N+1 database queries into a single batch query. No other code changes needed — all existing `get_post_meta()` calls in the loop will automatically use the primed cache. The `format_campaign()` helper also benefits since it reads multiple meta keys per campaign.

---

### TASK 2: Prime WP meta + term cache in `list_companies()`

**Priority:** High  
**Type:** Performance  
**Ref:** Sections 4B, 4C

In `class-wpsg-rest.php`, in the `list_companies()` method:

**Step 1:** After the `get_posts()` call that fetches all campaigns, prime the meta and term caches:
```php
$campaign_ids = wp_list_pluck($all_campaigns, 'ID');
update_meta_cache('post', $campaign_ids);
update_object_term_cache($campaign_ids, 'wpsg_company');
```

**Step 2:** Wrap the entire method's query logic in a transient cache using the same pattern as `list_campaigns()`:
- Cache key: `'wpsg_companies_' . get_option('wpsg_cache_version', 0)`
- TTL: 300 seconds (5 minutes, same as campaigns)
- Invalidation: already handled by `wpsg_cache_version` bump on data changes

---

### TASK 3: Wrap five bare-array PHP endpoints in `{ items: [...] }`

**Priority:** High  
**Type:** Data contract consistency  
**Ref:** Section 2A

For **each** of the following PHP methods in `class-wpsg-rest.php`, change the return from a bare array to an object wrapper:

1. **`list_access()`** — Change `return new WP_REST_Response($enriched, 200)` to `return new WP_REST_Response(['items' => $enriched], 200)`
2. **`list_company_access()`** — Same wrapping pattern
3. **`list_companies()`** — Same wrapping pattern. Also move the `X-WPSG-Total` header value into the response body (e.g., `'total' => count($companies)`)
4. **`list_access_requests()`** — Same wrapping pattern
5. **`list_audit()`** — Same wrapping pattern

Then update **React consumers**:
- `useCompanies` in `useAdminSWR.ts`: Change `data ?? []` to `data?.items ?? []`
- The other four hooks already go through `normalizeListResponse()` which checks `.items` — no change needed there

Additionally wrap the two tag endpoints for consistency:
6. **`list_campaign_tags()`** — Wrap both the error-case `[]` and the success-case `$result` in `['items' => ...]`
7. **`list_media_tags()`** — Same

---

### TASK 4: Convert analytics response keys from snake_case to camelCase

**Priority:** Medium  
**Type:** Data contract consistency  
**Ref:** Section 2B (Analytics)

**PHP** — `class-wpsg-rest.php`, `get_campaign_analytics()` (~line 1365):
- `'total_views'` → `'totalViews'`
- `'unique_visitors'` → `'uniqueVisitors'`

**React** — `src/services/apiClient.ts` (~line 568):
- `CampaignAnalyticsResponse.total_views` → `totalViews`
- `CampaignAnalyticsResponse.unique_visitors` → `uniqueVisitors`

**React** — `src/components/Admin/AnalyticsDashboard.tsx`:
- `data?.total_views` → `data?.totalViews` (~line 138)
- `data?.unique_visitors` → `data?.uniqueVisitors` (~line 143)

**React test** — `src/components/Admin/AnalyticsDashboard.test.tsx`:
- Update mock data to use `totalViews`, `uniqueVisitors` (~line 22-23, 83)

**PHP test** — `wp-plugin/.../tests/WPSG_REST_Extended_Test.php`:
- Update assertion to check `totalViews` instead of `total_views` (~line 234)

---

### TASK 5: Convert access request response keys from snake_case to camelCase

**Priority:** Medium  
**Type:** Data contract consistency  
**Ref:** Section 2B (Access Requests)

**PHP** — `class-wpsg-rest.php`, `format_access_request()` (~line 1732):
- `'campaign_id'` → `'campaignId'`
- `'requested_at'` → `'requestedAt'`
- `'resolved_at'` → `'resolvedAt'`

**React** — `src/services/apiClient.ts` (~line 593):
- `AccessRequest.campaign_id` → `campaignId`
- `AccessRequest.requested_at` → `requestedAt`
- `AccessRequest.resolved_at` → `resolvedAt`

**React** — `src/components/Admin/PendingRequestsPanel.tsx`:
- `req.requested_at` → `req.requestedAt` (~line 136)
- `req.resolved_at` → `req.resolvedAt` (~line 204, two references)

**React test** — `src/components/Admin/PendingRequestsPanel.test.tsx`:
- Update mock data for `campaignId`, `requestedAt`, `resolvedAt` (~lines 18-21, 27-30)

---

### TASK 6: Convert analytics event request body to camelCase

**Priority:** Medium  
**Type:** Data contract consistency  
**Ref:** Section 2B (Analytics Event)

**React** — `src/services/apiClient.ts`, `recordAnalyticsEvent()` (~line 258):
- Change request body from `{ campaign_id: campaignId, event_type: eventType }` to `{ campaignId, eventType }`

**PHP** — `class-wpsg-rest.php`, `record_analytics_event()` (~line 1271):
- Change `$request->get_param('campaign_id')` → `$request->get_param('campaignId')`
- Change `$request->get_param('event_type')` → `$request->get_param('eventType')`

---

### TASK 7: Convert `copy_media` request param to `copyMedia`

**Priority:** Low  
**Type:** Data contract consistency  
**Ref:** Section 3D

**React** — `src/services/apiClient.ts`, `duplicateCampaign()` body: Change `copy_media` key to `copyMedia`

**PHP** — `class-wpsg-rest.php`, `duplicate_campaign()`: Change `$request->get_param('copy_media')` → `$request->get_param('copyMedia')`

---

### TASK 8: Add 403 nonce-expired retry in apiClient

**Priority:** Low  
**Type:** Robustness  
**Ref:** Section 3A

In `src/services/apiClient.ts`, in the `handleResponse()` method (or a wrapper around `fetchWithTimeout`):

- If a request returns HTTP 403 and the error body indicates a nonce issue (e.g., `code === 'rest_cookie_invalid_nonce'`), perform one retry:
  1. Fetch `GET /wp-json/wp-super-gallery/v1/nonce`
  2. Update `window.__WPSG_CONFIG__.restNonce` and `window.__WPSG_REST_NONCE__`
  3. Replay the original request with the new nonce
  4. If the retry also fails, throw the original error

Use a flag to prevent infinite retry loops (max 1 retry per request).

---

### TASK 9: Increase prefetch concurrency

**Priority:** Low  
**Type:** Performance  
**Ref:** Section 4D

In `src/hooks/useAdminSWR.ts`, in the prefetch utility section:
- Increase `PREFETCH_CONCURRENCY` from 4 to 6
- Reduce access/audit stagger delay from 100ms to 50ms
- Keep media stagger at 150ms (larger payloads)

---

### TASK 10: Add `console.warn` for typographyOverrides parse failure

**Priority:** Low  
**Type:** Debuggability  
**Ref:** Section 3C

In `src/utils/mergeSettingsWithDefaults.ts`, in the `catch` block for `typographyOverrides` JSON parsing (~line 30), add:
```typescript
console.warn('[WPSG] Failed to parse typographyOverrides from server:', incoming);
```
