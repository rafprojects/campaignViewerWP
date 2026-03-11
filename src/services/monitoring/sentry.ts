type SentryInitOptions = {
  dsn?: string;
  tracesSampleRate?: number;
};

export async function initSentry(options: SentryInitOptions) {
  if (!options.dsn) return;
  if (import.meta.env.DEV) return;

  const Sentry = await import('@sentry/react');

  Sentry.init({
    dsn: options.dsn,
    tracesSampleRate: options.tracesSampleRate ?? 0.1,
    integrations: [],
    beforeSend(event) {
      // Strip Authorization headers from breadcrumbs to prevent PII leakage.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (b.data?.headers) {
            const { Authorization: _Auth, authorization: _auth, ...rest } = b.data.headers as Record<string, unknown>;
            b.data.headers = rest;
          }
          return b;
        });
      }
      // Redact user IP if Sentry auto-detected it.
      if (event.user) {
        delete event.user.ip_address;
      }
      return event;
    },
  });
}