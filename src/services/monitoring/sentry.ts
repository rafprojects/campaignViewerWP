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
  });
}