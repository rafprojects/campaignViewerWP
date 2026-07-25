import { useRef } from 'react';

/**
 * Keep a ref in sync with the latest value on every render, for a stable
 * callback/effect to read the freshest value without re-subscribing or
 * being listed as a dependency. This is the "ref mirrors latest value"
 * idiom used throughout this codebase (P73-E) — centralizing it here
 * keeps the deliberate `react-hooks/refs` suppression in one documented
 * place instead of scattered at every call site.
 *
 * Safe under this codebase's runtime: the write only ever matters once a
 * render actually commits (nothing reads the ref during render itself),
 * and this project does not run the React Compiler, whose stricter
 * purity model is what the rule is guarding against.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  // eslint-disable-next-line react-hooks/refs -- intentional, centralized mirror-ref pattern (see module doc above)
  ref.current = value;
  return ref;
}
