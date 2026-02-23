import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { MantineProvider } from '@mantine/core';
import { theme } from '../theme';
import { useBreakpoint } from './useBreakpoint';

// ── ResizeObserver mock ──────────────────────────────────────
// The global setup.ts installs a no-op ResizeObserver. We replace it here
// with one that captures callbacks so we can simulate container resizing.

type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

let observerCallback: ResizeObserverCallback | null = null;
let observerDisconnected = false;

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    observerCallback = cb;
    observerDisconnected = false;
  }
  observe() {}
  unobserve() {}
  disconnect() {
    observerDisconnected = true;
  }
}

function triggerResize(width: number) {
  if (!observerCallback) throw new Error('No ResizeObserver callback captured');
  observerCallback([
    {
      contentBoxSize: [{ inlineSize: width, blockSize: 0 }],
      contentRect: { width, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0 },
      borderBoxSize: [{ inlineSize: width, blockSize: 0 }],
      devicePixelContentBoxSize: [{ inlineSize: width, blockSize: 0 }],
      target: document.createElement('div'),
    } as unknown as ResizeObserverEntry,
  ]);
}

function triggerResizeContentRectOnly(width: number) {
  if (!observerCallback) throw new Error('No ResizeObserver callback captured');
  observerCallback([
    {
      // Simulate browsers that don't provide contentBoxSize
      contentBoxSize: undefined,
      contentRect: { width, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0 },
      borderBoxSize: undefined,
      devicePixelContentBoxSize: undefined,
      target: document.createElement('div'),
    } as unknown as ResizeObserverEntry,
  ]);
}

// ── Helpers ──────────────────────────────────────────────────

function Wrapper({ children }: PropsWithChildren) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

/** Create a ref object pointing to a fake container with the given clientWidth. */
function makeContainerRef(clientWidth: number) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  return { current: el } as React.RefObject<HTMLElement>;
}

// ── Mantine breakpoint thresholds ────────────────────────────
// Mantine default breakpoints: sm = "48em" → 768px, lg = "75em" → 1200px
// mobile < 768, tablet ∈ [768, 1200), desktop ≥ 1200

const originalResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  observerCallback = null;
  observerDisconnected = false;
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

// ── Tests ────────────────────────────────────────────────────

describe('useBreakpoint', () => {
  it('returns mobile when container width < 768px', () => {
    const ref = makeContainerRef(600);
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    // Initial measurement from el.clientWidth
    expect(result.current).toBe('mobile');
  });

  it('returns tablet when container width >= 768 and < 1200', () => {
    const ref = makeContainerRef(900);
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    expect(result.current).toBe('tablet');
  });

  it('returns desktop when container width >= 1200', () => {
    const ref = makeContainerRef(1400);
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    expect(result.current).toBe('desktop');
  });

  it('returns desktop for initial state before ref mounts', () => {
    const ref = { current: null } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    // No element → stays at default ('desktop')
    expect(result.current).toBe('desktop');
  });

  it('updates breakpoint when ResizeObserver fires', () => {
    const ref = makeContainerRef(1400);
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    expect(result.current).toBe('desktop');

    // Simulate resize to mobile width
    act(() => triggerResize(500));
    expect(result.current).toBe('mobile');

    // Simulate resize to tablet width
    act(() => triggerResize(1000));
    expect(result.current).toBe('tablet');

    // Back to desktop
    act(() => triggerResize(1500));
    expect(result.current).toBe('desktop');
  });

  it('uses contentRect.width fallback when contentBoxSize is unavailable', () => {
    const ref = makeContainerRef(1400);
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    act(() => triggerResizeContentRectOnly(500));
    expect(result.current).toBe('mobile');
  });

  it('handles exact boundary at 768px (returns tablet, not mobile)', () => {
    const ref = makeContainerRef(768);
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    // 768 is NOT less than 768, so it's tablet
    expect(result.current).toBe('tablet');
  });

  it('handles exact boundary at 1200px (returns desktop, not tablet)', () => {
    const ref = makeContainerRef(1200);
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    // 1200 is NOT less than 1200, so it's desktop
    expect(result.current).toBe('desktop');
  });

  it('handles width of 0 as mobile', () => {
    const ref = makeContainerRef(0);
    const { result } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    expect(result.current).toBe('mobile');
  });

  it('disconnects observer on unmount', () => {
    const ref = makeContainerRef(1000);
    const { unmount } = renderHook(() => useBreakpoint(ref), { wrapper: Wrapper });

    expect(observerDisconnected).toBe(false);
    unmount();
    expect(observerDisconnected).toBe(true);
  });
});
