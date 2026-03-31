export function createThemeScopeToken(): string {
  return `wpsg-theme-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeThemeScopeToken(value: string | null | undefined): string {
  const safeToken = (value ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '_');

  return safeToken || createThemeScopeToken();
}

export function escapeThemeScopeSelectorValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildThemeScopeSelector(scopeToken: string): string {
  return `[data-wpsg-theme-scope="${escapeThemeScopeSelectorValue(scopeToken)}"]`;
}

export function buildThemeStyleElementId(scopeToken: string): string {
  return `wpsg-theme-vars-${normalizeThemeScopeToken(scopeToken)}`;
}

export function ensureHostThemeScopeToken(host: HTMLElement): string {
  const scopeToken = normalizeThemeScopeToken(
    host.dataset.wpsgThemeScope || host.id || host.dataset.wpsgKey || createThemeScopeToken(),
  );

  host.dataset.wpsgThemeScope = scopeToken;
  return scopeToken;
}
