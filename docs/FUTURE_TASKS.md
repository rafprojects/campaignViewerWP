# Future Tasks & Enhancements

This document tracks deferred and exploratory work remaining after the Phase 16 release.

> Note: Items promoted to active phase execution are moved into dedicated phase reports and removed from this backlog.

---

## High Priority

Phase 11 intentionally deferred bulk actions after scope freeze.

- Add multi-select in admin media workflows
- Support batch delete/move actions
- Add clear confirmation UX and progress feedback

**Effort:** Medium  
**Impact:** High

### A1. Reduce App.tsx to ≤ 300 Lines (Stretch)

Core decomposition is improved, but orchestration remains centralized.

- Extract remaining orchestration into focused hooks/modules
- Consider `useReducer` or lightweight state store for modal/action orchestration

**Effort:** High  
**Impact:** Medium

### A2. Reduce AdminPanel.tsx to ≤ 200 Lines (Stretch)

Tabs are split, but orchestration and shared flows are still concentrated.

- Move cross-tab orchestration to dedicated admin state/hooks
- Replace remaining manual API flows with shared data abstractions

**Effort:** High  
**Impact:** Medium

---

## Deferred from Phase 6

### Monitoring & Infrastructure

#### Redis/Memcached Object Cache
- Configure object cache backends for high-traffic deployments
- Add monitoring and eviction guidance
- Document network/security constraints

**Effort:** Medium  
**Impact:** Medium

#### Usage Analytics
- Define event schema + storage strategy
- Add privacy/retention policy
- Build admin reporting UI

**Effort:** Medium  
**Impact:** Medium

#### WAF Rules (Optional)
- Baseline API rules
- SSRF pattern blocking guidance
- Edge rate-limit suggestions

**Effort:** Low  
**Impact:** Medium

#### Logging & Metrics Integration
- Opt-in external metrics integrations (StatsD/Prometheus)
- Structured logging + retention guidance

**Effort:** Medium  
**Impact:** Low

---

## Developer Tools

### Contributor Tooling & Documentation

- Storybook for component development
- API docs via OpenAPI/Swagger
- Pre-commit tooling (Husky/lint/test gates)
- Further TypeScript strictness improvements
- Conventional commits and contributor docs
- ADRs and dev-setup improvements

**Effort:** Medium  
**Impact:** Medium

### WP-CLI Commands

Add `wpsg` WP-CLI command set for admin/debug workflows.

- Campaign/media/access operations
- Cache diagnostics/clear commands
- Failure counter inspection/reset

**Effort:** Low  
**Impact:** Low

---

## Deferred from Phase 10

### Track F Feature Ideas (Open)

| Feature | Effort | Impact | Notes |
|---------|--------|--------|-------|
| Bulk media operations (multi-select delete/move) | Medium | High | Common admin workflow |
| Campaign duplication ("Clone Campaign") | Low | Medium | Copy campaign + media metadata |
| Keyboard shortcuts for admin (`Ctrl+N`, `Ctrl+S`) | Low | Medium | Mantine `useHotkeys` |
| Export/import campaigns as JSON | Medium | Medium | Migration between WP instances |
| Campaign analytics dashboard (view counts) | High | Medium | Requires event tracking backend |

---

## Feature Ideas (Not Committed)

### Media Management
- Media sorting controls (alpha, type, date)
- Duplicate media detection
- Media usage tracking across campaigns

### Campaign Features
- Campaign templates
- Campaign categories/folders

### Access Control
- Role-based access levels (view, edit, admin)
- Time-limited access grants
- Access request workflow
- Access totals summary UI
- Access audit log export

### Performance
- Progressive Web App (PWA) support

### UX Workflow
- Convert settings panel from full-page shift to non-disruptive loading modal workflow
- Reuse loaded Admin tab data across switches when filters/targets have not changed

### Integration
- Third-party OAuth providers (Google, GitHub)
- Webhook support for campaign events
- REST API documentation (OpenAPI/Swagger)
- GraphQL API alternative

---

## Evaluation Criteria

When considering future tasks:

1. User impact
2. Implementation effort
3. Maintenance burden
4. Alignment with core mission
5. Viable alternatives

---

*Document created: February 1, 2026*  
*Last updated: February 22, 2026 — Phase 14 tracks promoted (external thumbnail cache, oEmbed monitoring/rate-limiting, admin metrics/health, image optimization, media & campaign tagging). Removed E1 SWR (completed in P13-C).*
