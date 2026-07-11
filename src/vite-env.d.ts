/// <reference types="vite/client" />

/**
 * P62-F: build-time premium flag, replaced by Vite `define` with a literal boolean.
 * `true` in the default (premium) build; `false` in the `WPSG_PREMIUM=false` free build,
 * which lets Rollup dead-code-eliminate the Pro authoring code. Orthogonal to the runtime
 * `isPro` license check (`useWpsgLicense`). See docs/guides/PRO_FEATURES.md.
 */
declare const __WPSG_PREMIUM__: boolean;

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.scss?inline' {
  const content: string;
  export default content;
}

declare module '*.module.scss?inline' {
  const content: string;
  export default content;
}

interface Window {
  __USE_SHADOW_DOM__?: boolean;
  __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
  __WPSG_API_BASE__?: string;
  __WPSG_ACCESS_MODE__?: 'lock' | 'hide';
  __WPSG_CONFIG__?: {
    sentryDsn?: string;
    allowUserThemeOverride?: boolean;
    restNonce?: string;
    theme?: string;
    /** P20-K: When true, JWT auth flow is enabled (cross-origin/headless). Default: WP nonce-only. */
    enableJwt?: boolean;
    apiBase?: string;
    /** P20-I-6: When true, multiple shortcodes share one React root via portals. Default: false. */
    sharedRoot?: boolean;
    /** When true, explicit React displayName labels and data-wpsg-component/slot DOM markers are enabled for debugging. */
    debugComponentMarkers?: boolean;
    /** P50-F: Absolute URL of sw.js served by the plugin PHP endpoint (with Service-Worker-Allowed: / header). */
    swUrl?: string;
    /** P62-A: license/entitlement state for pro-feature gating. Read by src/hooks/useWpsgLicense.ts. */
    license?: {
      isPro: boolean;
      tier: string | null;
      upgradeUrl: string;
    };
  };
  __WPSG_REST_NONCE__?: string;
  __WPSG_SENTRY_DSN__?: string;
  __wpsgThemeId?: string;
  __WPSG_VITALS__?: Array<{ name: string; value: number; id: string; delta?: number; entries?: PerformanceEntry[] }>;
}
