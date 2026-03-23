import type { Breakpoint } from '@/hooks/useBreakpoint';

export interface BreakpointValueMap<T> {
  desktop: T;
  tablet?: T;
  mobile?: T;
}

/**
 * Resolve a value for the current breakpoint using top-down inheritance.
 * Mobile falls back to tablet then desktop; tablet falls back to desktop.
 */
export function resolveBreakpointValue<T>(
  breakpoint: Breakpoint,
  values: BreakpointValueMap<T>,
): T {
  if (breakpoint === 'mobile') {
    return values.mobile ?? values.tablet ?? values.desktop;
  }

  if (breakpoint === 'tablet') {
    return values.tablet ?? values.desktop;
  }

  return values.desktop;
}

export function combineMaxWidthConstraints(
  ...values: Array<string | undefined>
): string | undefined {
  const defined = values.filter((value): value is string => Boolean(value));

  if (defined.length === 0) {
    return undefined;
  }

  if (defined.length === 1) {
    return defined[0];
  }

  return `min(${defined.join(', ')})`;
}
