/// <reference types="vite/client" />

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
  };
  __WPSG_REST_NONCE__?: string;
  __WPSG_SENTRY_DSN__?: string;
  __wpsgThemeId?: string;
  __WPSG_VITALS__?: Array<{ name: string; value: number; id: string; delta?: number; entries?: PerformanceEntry[] }>;
}
