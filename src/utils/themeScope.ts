export function createThemeScopeToken(): string {
  return `mullion-theme-${Math.random().toString(36).slice(2, 10)}`;
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
  return `[data-mullion-theme-scope="${escapeThemeScopeSelectorValue(scopeToken)}"]`;
}

export function buildThemeStyleElementId(scopeToken: string): string {
  return `mullion-theme-vars-${normalizeThemeScopeToken(scopeToken)}`;
}

export function ensureHostThemeScopeToken(host: HTMLElement): string {
  const scopeToken = normalizeThemeScopeToken(
    host.dataset.mullionThemeScope || host.id || host.dataset.mullionKey || createThemeScopeToken(),
  );

  host.dataset.mullionThemeScope = scopeToken;
  return scopeToken;
}
