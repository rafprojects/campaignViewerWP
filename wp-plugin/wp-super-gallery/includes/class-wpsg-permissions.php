<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * WPSG_Permissions — centralized authorization map (P52-A).
 *
 * Single source of truth for which gate guards each REST action. Every
 * `register_rest_route()` permission_callback in the plugin resolves through
 * {@see WPSG_Permissions::gate()}, so this MAP is the complete, auditable
 * "tier × surface" matrix the RBAC redesign promised (docs/PHASE52_REPORT.md
 * › Track P52-A).
 *
 * ── How it works ──────────────────────────────────────────────────────────
 * MAP keys are stable *action* identifiers (`resource.verb`). Each value is a
 * *strategy*: the name of a permission primitive declared on WPSG_REST_Base
 * (or the literal `__return_true` for intentionally public endpoints). The
 * strategy name IS the tier/scope encoding — see the legend below.
 *
 * ── Strategy legend (tier / scope) ────────────────────────────────────────
 *   __return_true               public        — no auth (read-only / login)
 *   rate_limit_public           public        — unauthenticated, IP rate-limited
 *   rate_limit_magic_approve    public        — unauthenticated, tight rate limit
 *   require_authenticated       authenticated — any logged-in user (self scope)
 *   rate_limit_authenticated    manage_options— user creation, rate-limited (System Admin)
 *   require_admin               manage_wpsg   — global admin (bare cap, no space scope)
 *   require_system_admin        manage_options— System Admin only (WP dashboard tier)
 *   require_campaign_editor     grant         — campaign editor|owner (manage_wpsg bypass)
 *   require_campaign_owner      grant         — campaign owner (manage_wpsg bypass)
 *   require_campaign_space_access       manage_wpsg + space — per-campaign admin op, scoped to the campaign's space
 *   require_campaign_batch_space_access manage_wpsg + space — batch variant, every id's space must be accessible
 *   require_campaign_space_move grant         — owner of BOTH source & target space
 *   require_space_member        grant         — any access level in the space
 *   require_space_owner         grant         — owner level in the space
 *
 * ── P52-A staging ─────────────────────────────────────────────────────────
 * A1 (this commit) wires the map to the *current* gates verbatim — a provable
 * baseline with no behavior change. A4/A5 reclassify individual rows (e.g.
 * system-level `require_admin` → a new `require_system_admin` keyed on
 * manage_options; per-campaign `require_admin` → space-scoped). Each change is
 * a one-line MAP edit asserted by WPSG_P52A_Permission_Matrix_Test.
 *
 * @since P52-A1
 */
final class WPSG_Permissions {

    /**
     * Action → strategy map. Grouped by controller; inline comments record the
     * HTTP method + route each action guards.
     *
     * @var array<string,string>
     */
    const MAP = [
        // ── WPSG_Analytics_Controller ──────────────────────────────────────
        'analytics.event.record'          => 'rate_limit_public',          // POST   /analytics/event
        'analytics.campaign.read'          => 'require_campaign_space_access',              // GET    /analytics/campaigns/{id}
        'analytics.campaign.media.read'    => 'require_campaign_space_access',              // GET    /analytics/campaigns/{id}/media
        'analytics.summary.read'           => 'require_system_admin',              // GET    /analytics/summary

        // ── WPSG_Auth_Controller ───────────────────────────────────────────
        'auth.permissions.read'            => 'require_authenticated',      // GET    /permissions
        'auth.nonce.refresh'               => 'require_authenticated',      // GET    /nonce
        'auth.login'                       => '__return_true',              // POST   /auth/login
        'auth.logout'                      => 'require_authenticated',      // POST   /auth/logout
        'users.search'                     => 'require_admin',              // GET    /users/search
        'users.create'                     => 'rate_limit_authenticated',   // POST   /users
        'roles.list'                       => 'require_system_admin',              // GET    /roles

        // ── WPSG_Access_Controller ─────────────────────────────────────────
        'campaigns.access_summary.read'    => 'require_system_admin',              // GET    /campaigns/access-summary
        'campaign.access.list'             => 'require_campaign_owner',     // GET    /campaigns/{id}/access
        'campaign.access.grant'            => 'require_campaign_owner',     // POST   /campaigns/{id}/access
        'campaign.access.revoke'           => 'require_campaign_owner',     // DELETE /campaigns/{id}/access/{userId}
        'campaign.access_request.submit'   => 'rate_limit_public',          // POST   /campaigns/{id}/access-requests
        'campaign.access_request.list'     => 'require_campaign_owner',     // GET    /campaigns/{id}/access-requests
        'campaign.access_request.approve'  => 'require_campaign_owner',     // POST   /campaigns/{id}/access-requests/{token}/approve
        'campaign.access_request.deny'     => 'require_campaign_owner',     // POST   /campaigns/{id}/access-requests/{token}/deny
        'campaign.access_request.magic_approve' => 'rate_limit_magic_approve', // GET /campaigns/{id}/access-requests/{token}/magic-approve
        'company.access.list'              => 'require_system_admin',              // GET    /companies/{id}/access
        'company.access.grant'             => 'require_system_admin',              // POST   /companies/{id}/access
        'company.access.revoke'            => 'require_system_admin',              // DELETE /companies/{id}/access/{userId}
        'company.archive'                  => 'require_system_admin',              // POST   /companies/{id}/archive

        // ── WPSG_Media_Controller ──────────────────────────────────────────
        'media.usage_summary.read'         => 'require_system_admin',              // GET    /media/usage-summary
        'media.usage.read'                 => 'require_system_admin',              // GET    /media/{mediaId}/usage
        'campaign.media.list'              => 'rate_limit_public',          // GET    /campaigns/{id}/media
        'campaign.media.create'            => 'require_campaign_editor',    // POST   /campaigns/{id}/media
        'campaign.media.create_batch'      => 'require_campaign_editor',    // POST   /campaigns/{id}/media/batch
        'campaign.media.reorder'           => 'require_campaign_editor',    // PUT    /campaigns/{id}/media/reorder
        'campaign.media.rescan'            => 'require_campaign_editor',    // POST   /campaigns/{id}/media/rescan
        'campaign.media.update'            => 'require_campaign_editor',    // PUT    /campaigns/{id}/media/{mediaId}
        'campaign.media.delete'            => 'require_campaign_editor',    // DELETE /campaigns/{id}/media/{mediaId}
        'media.rescan_all'                 => 'require_system_admin',              // POST   /media/rescan-all
        'media.library.list'               => 'require_system_admin',              // GET    /media/library
        'media.upload'                     => 'require_admin',              // POST   /media/upload
        'media_tags.list'                  => 'require_admin',              // GET    /tags/media
        'media_tags.create'                => 'require_admin',              // POST   /tags/media
        'media_tags.delete'                => 'require_admin',              // DELETE /tags/media/{id}
        'media.export_binary'              => 'require_system_admin',              // POST   /admin/media/export/binary
        'media.import_binary'              => 'require_system_admin',              // POST   /media/import/binary

        // ── WPSG_Content_Controller ────────────────────────────────────────
        'categories.list'                  => 'require_admin',              // GET    /campaign-categories
        'categories.create'                => 'require_admin',              // POST   /campaign-categories
        'categories.update'                => 'require_admin',              // PUT    /campaign-categories/{id}
        'categories.delete'                => 'require_admin',              // DELETE /campaign-categories/{id}
        'campaign_templates.list'          => 'require_admin',              // GET    /campaign-templates
        'campaign_templates.create'        => 'require_admin',              // POST   /campaign-templates
        'campaign_templates.delete'        => 'require_admin',              // DELETE /campaign-templates/{id}
        'campaign_templates.instantiate'   => 'require_admin',              // POST   /campaign-templates/{id}/instantiate
        'companies.list'                   => 'require_admin',              // GET    /companies
        'campaign_tags.list'               => 'require_admin',              // GET    /tags/campaign
        'campaign_tags.create'             => 'require_admin',              // POST   /tags/campaign
        'campaign_tags.delete'             => 'require_admin',              // DELETE /tags/campaign/{id}
        'layout_templates.list'            => 'require_admin',              // GET    /admin/layout-templates
        'layout_templates.create'          => 'require_admin',              // POST   /admin/layout-templates
        'layout_templates.read'            => 'require_admin',              // GET    /admin/layout-templates/{templateId}
        'layout_templates.update'          => 'require_admin',              // PUT    /admin/layout-templates/{templateId}
        'layout_templates.delete'          => 'require_admin',              // DELETE /admin/layout-templates/{templateId}
        'layout_templates.duplicate'       => 'require_admin',              // POST   /admin/layout-templates/{templateId}/duplicate
        'assets.list'                      => 'require_admin',              // GET    /admin/asset-library
        'assets.upload'                    => 'require_admin',              // POST   /admin/asset-library
        'assets.update'                    => 'require_admin',              // POST   /admin/asset-library/{id}
        'assets.delete'                    => 'require_admin',              // DELETE /admin/asset-library/{id}
        'fonts.list'                       => 'require_admin',              // GET    /admin/font-library
        'fonts.upload'                     => 'require_admin',              // POST   /admin/font-library
        'fonts.update'                     => 'require_admin',              // POST   /admin/font-library/{id}
        'fonts.delete'                     => 'require_admin',              // DELETE /admin/font-library/{id}
        'layout_templates.read_public'     => '__return_true',             // GET    /layout-templates/{templateId}

        // ── WPSG_Settings_Controller ───────────────────────────────────────
        'settings.read_public'             => 'rate_limit_public',          // GET    /settings
        'settings.update'                  => 'require_admin',              // POST   /settings
        'settings.patch'                   => 'require_admin',              // PATCH  /settings

        // ── WPSG_Export_Controller ─────────────────────────────────────────
        'campaigns.batch.export_binary'    => 'require_campaign_batch_space_access',              // POST   /campaigns/batch/export/binary
        'campaign.export'                  => 'require_campaign_space_access',              // GET    /campaigns/{id}/export
        'campaigns.import'                 => 'require_system_admin',              // POST   /campaigns/import
        'campaign.export_binary'           => 'require_campaign_space_access',              // POST   /campaigns/{id}/export/binary
        'campaigns.import_binary'          => 'require_system_admin',              // POST   /campaigns/import/binary
        'export_jobs.read'                 => 'require_admin',              // GET    /export-jobs/{job_id}
        'export_jobs.delete'               => 'require_admin',              // DELETE /export-jobs/{job_id}
        'export_jobs.download'             => 'require_admin',              // GET    /export-jobs/{job_id}/download

        // ── WPSG_System_Controller ─────────────────────────────────────────
        'system.oembed_proxy'              => '__return_true',             // GET    /oembed
        'system.health.read'               => 'require_system_admin',              // GET    /admin/health
        'system.oembed_failures.read'      => 'require_system_admin',              // GET    /admin/oembed-failures
        'system.oembed_failures.reset'     => 'require_system_admin',              // DELETE /admin/oembed-failures
        'system.thumbnail_cache.read'      => 'require_system_admin',              // GET    /admin/thumbnail-cache
        'system.thumbnail_cache.clear'     => 'require_system_admin',              // DELETE /admin/thumbnail-cache
        'system.thumbnail_cache.refresh'   => 'require_system_admin',              // POST   /admin/thumbnail-cache/refresh
        'webhooks.list'                    => 'require_system_admin',              // GET    /webhooks
        'webhooks.create'                  => 'require_system_admin',              // POST   /webhooks
        'webhooks.delivery_log.read'       => 'require_system_admin',              // GET    /webhooks/delivery-log
        'webhooks.update'                  => 'require_system_admin',              // PUT    /webhooks/{index}
        'webhooks.delete'                  => 'require_system_admin',              // DELETE /webhooks/{index}
        'webhooks.rotate_secret'           => 'require_system_admin',              // POST   /webhooks/{index}/rotate-secret

        // ── WPSG_Space_Controller ──────────────────────────────────────────
        'spaces.list'                      => 'require_admin',              // GET    /spaces
        'spaces.create'                    => 'require_system_admin',              // POST   /spaces
        'space.read'                       => 'require_space_member',       // GET    /spaces/{id}
        'space.update'                     => 'require_space_owner',        // PUT    /spaces/{id}
        'space.delete'                     => 'require_space_owner',        // DELETE /spaces/{id}
        'space.access.list'                => 'require_space_owner',        // GET    /spaces/{id}/access
        'space.access.grant'               => 'require_space_owner',        // POST   /spaces/{id}/access
        'space.access.revoke'              => 'require_space_owner',        // DELETE /spaces/{id}/access/{userId}
        'space.resolve_user'               => 'require_space_owner',        // GET    /spaces/{id}/resolve-user
        'space.settings.read'              => 'require_space_member',       // GET    /spaces/{id}/settings
        'space.settings.update'            => 'require_space_owner',        // PUT    /spaces/{id}/settings
        'space.library.read'               => 'require_space_member',       // GET    /spaces/{id}/library
        'space.library.associate'          => 'require_space_owner',        // POST   /spaces/{id}/library
        'space.library.dissociate'         => 'require_space_owner',        // DELETE /spaces/{id}/library

        // ── WPSG_Campaign_Controller ───────────────────────────────────────
        'campaigns.list'                   => 'rate_limit_public',          // GET    /campaigns
        'campaigns.create'                 => 'require_admin',              // POST   /campaigns
        'campaign.read'                    => 'rate_limit_public',          // GET    /campaigns/{id}
        'campaign.update'                  => 'require_campaign_editor',    // PUT    /campaigns/{id}
        'campaign.delete'                  => 'require_campaign_owner',     // DELETE /campaigns/{id}
        'campaign.archive'                 => 'require_campaign_owner',     // POST   /campaigns/{id}/archive
        'campaign.restore'                 => 'require_campaign_owner',     // POST   /campaigns/{id}/restore
        'campaign.duplicate'               => 'require_campaign_editor',    // POST   /campaigns/{id}/duplicate
        'campaign.move'                    => 'require_campaign_space_move', // POST  /campaigns/{id}/move
        'campaigns.batch'                  => 'require_campaign_batch_space_access',              // POST   /campaigns/batch
        'campaign.audit.read'              => 'require_campaign_space_access',              // GET    /campaigns/{id}/audit
        'system.audit_log.read'            => 'require_system_admin',              // GET    /admin/audit-log
        'system.audit_log.export_binary'   => 'require_system_admin',              // POST   /admin/audit-log/export/binary
    ];

    /**
     * Strategies that take no request and always grant — handled inline by
     * check() rather than dispatched to a method.
     */
    const ALWAYS_ALLOW = '__return_true';

    /**
     * Resolve the strategy for an action.
     *
     * @return string Strategy name, or '' if the action is unknown.
     */
    public static function strategy(string $action): string {
        return self::MAP[$action] ?? '';
    }

    /** All known action identifiers. */
    public static function actions(): array {
        return array_keys(self::MAP);
    }

    /** Whether an action is registered in the map. */
    public static function has(string $action): bool {
        return array_key_exists($action, self::MAP);
    }

    /**
     * Evaluate the requirement for an action. Suitable signature for a REST
     * permission callback (receives the dispatched WP_REST_Request).
     *
     * Fails closed: an unmapped action is never authorized.
     *
     * @param string               $action
     * @param WP_REST_Request|null $request
     * @return bool|WP_Error
     */
    public static function check(string $action, $request = null) {
        $strategy = self::MAP[$action] ?? null;

        if ($strategy === null) {
            return false; // unknown action → deny
        }

        if ($strategy === self::ALWAYS_ALLOW) {
            return true;
        }

        // All strategies are public static primitives on WPSG_REST_Base. Those
        // that ignore the request (require_admin, require_authenticated) accept
        // the extra argument harmlessly; the scoped ones read it.
        return call_user_func([WPSG_REST_Base::class, $strategy], $request);
    }

    /**
     * Build a permission_callback bound to a specific action. Used at route
     * registration: `'permission_callback' => WPSG_Permissions::gate('foo.bar')`.
     *
     * @return Closure(WP_REST_Request=):(bool|WP_Error)
     */
    public static function gate(string $action): Closure {
        if (!array_key_exists($action, self::MAP)) {
            _doing_it_wrong(
                __METHOD__,
                sprintf('Unknown WPSG permission action: %s', esc_html($action)),
                'P52-A1'
            );
        }

        return static function ($request = null) use ($action) {
            return self::check($action, $request);
        };
    }
}
