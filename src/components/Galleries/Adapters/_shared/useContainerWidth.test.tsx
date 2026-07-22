/**
 * Phase 70-A: unit tests for the shared container-width hook.
 *
 * Locks in the exact behaviour extracted from the Diamond/Hexagonal adapters:
 * a synchronous `clientWidth` seed on mount, live updates from the
 * ResizeObserver's `contentRect.width`, and observer teardown on unmount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { render, screen, act } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import { useContainerWidth } from './useContainerWidth';

let roCallback: ResizeObserverCallback | undefined;
const observe = vi.fn();
const disconnect = vi.fn();

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    roCallback = cb;
  }
  observe = observe;
  unobserve = vi.fn();
  disconnect = disconnect;
}

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(ref);
  return (
    <div ref={ref} data-testid="probe">
      {width}
    </div>
  );
}

function stubClientWidth(value: number) {
  return vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(value);
}

describe('useContainerWidth', () => {
  // Clear the shared observer spies at the *start* of each test — Testing
  // Library's auto-cleanup unmounts the previous test's tree (firing a
  // disconnect) during its own afterEach, so clearing there would let that
  // stray call bleed into the next test's counts.
  beforeEach(() => {
    roCallback = undefined;
    observe.mockClear();
    disconnect.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('seeds the width from the initial clientWidth read on mount', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    stubClientWidth(640);

    render(<Probe />);

    expect(observe).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('probe')).toHaveTextContent('640');
  });

  it('updates the width when the observer reports a new content-box width', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    stubClientWidth(0);

    render(<Probe />);

    act(() => {
      roCallback?.([{ contentRect: { width: 812 } } as ResizeObserverEntry], {} as ResizeObserver);
    });

    expect(screen.getByTestId('probe')).toHaveTextContent('812');
  });

  it('disconnects the observer on unmount', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    stubClientWidth(100);

    const { unmount } = render(<Probe />);
    unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
