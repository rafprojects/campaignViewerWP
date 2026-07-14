/**
 * useWpsgLicense — read pro/free license state (P62-A).
 *
 * Reads `window.__WPSG_CONFIG__.license`, emitted by WPSG_Embed::page_config_js()
 * on both the front-end shortcode page and the wp-admin Spaces/Admin pages.
 * The value flows from the PHP entitlement seam (WPSG_License), which defaults
 * to the free tier (isPro=false) until real Freemius credentials are wired via
 * the `wpsg_freemius_config` filter.
 *
 * Reads the global config directly (the same convention as src/main.tsx) rather
 * than introducing a React Context — there is no config-context to extend.
 */

/** Placeholder pricing URL used when the config omits one (pre-M3). */
const DEFAULT_UPGRADE_URL = 'https://your-site.tld/pricing';

export interface WpsgLicenseInfo {
  /** True when a valid pro license is active. */
  isPro: boolean;
  /** Machine-readable tier label (e.g. "single" / "5-site" / "agency"), or null. */
  tier: string | null;
  /** Upgrade/pricing URL for upsell CTAs. */
  upgradeUrl: string;
}

export function useWpsgLicense(): WpsgLicenseInfo {
  const license = window.__WPSG_CONFIG__?.license;
  return {
    isPro: license?.isPro ?? false,
    tier: license?.tier ?? null,
    // `||` so an empty string (WPSG_License unavailable) also falls back.
    upgradeUrl: license?.upgradeUrl || DEFAULT_UPGRADE_URL,
  };
}
