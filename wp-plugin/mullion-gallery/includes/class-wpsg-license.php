<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * WPSG_License — entitlement (license) state, orthogonal to WPSG_Permissions (P62-A).
 *
 * WPSG_Permissions answers "WHO may call this REST route" (role/capability:
 * manage_options / manage_wpsg / logged-in viewer). WPSG_License answers "IS
 * this pro feature unlocked for this site" (entitlement/license). These are
 * deliberately separate concerns: a permission failure hard-blocks a request
 * (403); an entitlement failure lets the request succeed but silently degrades
 * the pro payload (see WPSG_Layout_Templates). Do NOT fold entitlement into
 * WPSG_Permissions::MAP.
 *
 * ── Credential-ready (mirrors WPSG_Sentry / wpsg_sentry_dsn) ────────────────
 * With no Freemius credentials configured, wpsg_fs() (wp-super-gallery.php)
 * returns null and every check below falls back to the `wpsg_license_is_pro`
 * filter, which defaults to false (free tier). This lets the whole plugin run
 * correctly — and lets QA simulate a licensed state via
 * `add_filter('wpsg_license_is_pro', '__return_true')` — with zero real
 * Freemius credentials. Real credentials are injected outside this repo (a
 * site-specific mu-plugin or wp-config.php-backed constant read into the
 * `wpsg_freemius_config` filter) and are never committed.
 *
 * @since P62-A
 */
final class WPSG_License {

    /**
     * One constant per gated feature (P62-A). All currently collapse to the
     * same can_use_premium_code() check via can_use_feature(), but keeping them
     * distinct lets a future Freemius multi-plan config differentiate (e.g.
     * text layers in a base pro plan, starter library in a higher tier) without
     * touching any call site.
     */
    const FEATURE_LAYOUT_TEXT_LAYERS          = 'layout_text_layers';
    const FEATURE_LAYOUT_BREAKPOINT_OVERRIDES = 'layout_breakpoint_overrides';
    const FEATURE_LAYOUT_STARTER_LIBRARY      = 'layout_starter_library';

    /**
     * Raw Freemius credential bag. Default empty — never commit real values.
     * Shared with wp-super-gallery.php's wpsg_fs() bootstrap via the same filter.
     *
     * @return array{id:string,public_key:string,is_premium:bool}
     */
    public static function get_config(): array {
        $config = apply_filters('wpsg_freemius_config', [
            'id'         => '',   // Freemius Plugin ID.
            'public_key' => '',   // Freemius public API key.
            'is_premium' => false,
        ]);
        return is_array($config) ? $config : [];
    }

    /**
     * True once real credentials exist AND the Freemius SDK has loaded.
     */
    public static function is_sdk_active(): bool {
        return function_exists('wpsg_fs') && wpsg_fs() !== null;
    }

    /**
     * Coarse "any pro feature unlocked" check.
     */
    public static function can_use_premium_code(): bool {
        if (self::is_sdk_active()) {
            return (bool) wpsg_fs()->can_use_premium_code();
        }
        // Stub path: default false (safe/free) until wired to a real license.
        return (bool) apply_filters('wpsg_license_is_pro', false);
    }

    /**
     * Per-feature check. Extensible seam for a future multi-plan Freemius config:
     * today every feature collapses to can_use_premium_code(), but a filter can
     * override any single feature independently.
     *
     * @param string $feature One of the FEATURE_* constants.
     */
    public static function can_use_feature(string $feature): bool {
        return (bool) apply_filters('wpsg_license_feature_enabled', self::can_use_premium_code(), $feature);
    }

    /**
     * Machine-readable tier label for display (e.g. "single" / "5-site" /
     * "agency"), or null when unlicensed / not yet wired.
     */
    public static function get_tier(): ?string {
        if (self::is_sdk_active() && method_exists(wpsg_fs(), 'get_plan')) {
            $plan = wpsg_fs()->get_plan();
            if ($plan && !empty($plan->name)) {
                return (string) $plan->name;
            }
            return null;
        }
        $tier = apply_filters('wpsg_license_tier', null);
        return is_string($tier) && $tier !== '' ? $tier : null;
    }

    /**
     * Upgrade/pricing URL for upsell CTAs. When the Freemius SDK is live it defaults
     * to Freemius's own pricing/checkout URL — so buyers reach real checkout even if
     * the `wpsg_license_upgrade_url` filter is never set (P62-K); otherwise it falls
     * back to the placeholder. The filter always overrides (P62-C / M2-M3). Mirrors
     * the SDK-delegation pattern in get_tier().
     */
    public static function get_upgrade_url(): string {
        $default = 'https://your-site.tld/pricing';
        if (self::is_sdk_active() && method_exists(wpsg_fs(), 'get_upgrade_url')) {
            $sdk_url = wpsg_fs()->get_upgrade_url();
            if (is_string($sdk_url) && $sdk_url !== '') {
                $default = $sdk_url;
            }
        }
        return (string) apply_filters('wpsg_license_upgrade_url', $default);
    }
}
