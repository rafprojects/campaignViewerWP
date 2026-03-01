import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '../../test/test-utils';
import { OverlayArrows } from './OverlayArrows';
import type { GalleryBehaviorSettings } from '@/types';

const BASE_SETTINGS: GalleryBehaviorSettings = {
  navArrowPosition: 'center',
  navArrowSize: 40,
  navArrowColor: '#ffffff',
  navArrowBgColor: 'rgba(0,0,0,0.4)',
  navArrowBorderWidth: 0,
  navArrowHoverScale: 1.2,
  navArrowAutoHideMs: 0,
} as unknown as GalleryBehaviorSettings;

describe('OverlayArrows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when total <= 1', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={1}
        settings={BASE_SETTINGS}
      />,
    );
    expect(screen.queryByLabelText('Previous')).toBeNull();
    expect(screen.queryByLabelText('Next')).toBeNull();
  });

  it('renders prev and next buttons when total > 1', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={3}
        settings={BASE_SETTINGS}
      />,
    );
    expect(screen.getByLabelText('Previous')).toBeInTheDocument();
    expect(screen.getByLabelText('Next')).toBeInTheDocument();
  });

  it('calls onPrev when prev button is clicked', () => {
    const onPrev = vi.fn();
    render(
      <OverlayArrows
        onPrev={onPrev}
        onNext={vi.fn()}
        total={3}
        settings={BASE_SETTINGS}
      />,
    );
    fireEvent.click(screen.getByLabelText('Previous'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when next button is clicked', () => {
    const onNext = vi.fn();
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={onNext}
        total={3}
        settings={BASE_SETTINGS}
      />,
    );
    fireEvent.click(screen.getByLabelText('Next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders custom previousLabel and nextLabel', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={3}
        settings={BASE_SETTINGS}
        previousLabel="Go back"
        nextLabel="Go forward"
      />,
    );
    expect(screen.getByLabelText('Go back')).toBeInTheDocument();
    expect(screen.getByLabelText('Go forward')).toBeInTheDocument();
  });

  it('handleHover applies scale transform on mouseEnter', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={3}
        settings={{ ...BASE_SETTINGS, navArrowHoverScale: 1.5 }}
      />,
    );
    const prev = screen.getByLabelText('Previous') as HTMLButtonElement;
    fireEvent.mouseEnter(prev);
    expect(prev.style.transform).toBe('scale(1.5)');
  });

  it('handleHover resets transform on mouseLeave', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={3}
        settings={{ ...BASE_SETTINGS, navArrowHoverScale: 1.5 }}
      />,
    );
    const prev = screen.getByLabelText('Previous') as HTMLButtonElement;
    fireEvent.mouseEnter(prev);
    fireEvent.mouseLeave(prev);
    expect(prev.style.transform).toBe('scale(1)');
  });

  it('arrows visible when navArrowAutoHideMs === 0', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={3}
        settings={{ ...BASE_SETTINGS, navArrowAutoHideMs: 0 }}
      />,
    );
    const prev = screen.getByLabelText('Previous') as HTMLButtonElement;
    expect(prev.style.opacity).toBe('1');
  });

  it('arrows initially hidden when navArrowAutoHideMs > 0', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={3}
        settings={{ ...BASE_SETTINGS, navArrowAutoHideMs: 2000 }}
      />,
    );
    const prev = screen.getByLabelText('Previous') as HTMLButtonElement;
    expect(prev.style.opacity).toBe('0');
  });

  it('mousemove on parent shows arrows then hides after timeout', () => {
    render(
      <div data-testid="parent">
        <OverlayArrows
          onPrev={vi.fn()}
          onNext={vi.fn()}
          total={3}
          settings={{ ...BASE_SETTINGS, navArrowAutoHideMs: 1000 }}
        />
      </div>,
    );
    const parent = screen.getByTestId('parent');
    const prev = screen.getByLabelText('Previous') as HTMLButtonElement;

    // Initially hidden
    expect(prev.style.opacity).toBe('0');

    // Simulate mousemove on parent
    act(() => {
      fireEvent.mouseMove(parent);
    });
    expect(prev.style.opacity).toBe('1');

    // After 1000ms timer fires → hidden again
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(prev.style.opacity).toBe('0');
  });

  it('navArrowPosition top renders arrows at top', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={3}
        settings={{ ...BASE_SETTINGS, navArrowPosition: 'top' }}
      />,
    );
    const prev = screen.getByLabelText('Previous') as HTMLButtonElement;
    expect(prev.style.top).toBe('12px');
  });

  it('navArrowPosition bottom renders arrows at bottom', () => {
    render(
      <OverlayArrows
        onPrev={vi.fn()}
        onNext={vi.fn()}
        total={3}
        settings={{ ...BASE_SETTINGS, navArrowPosition: 'bottom' }}
      />,
    );
    const prev = screen.getByLabelText('Previous') as HTMLButtonElement;
    expect(prev.style.bottom).toBe('12px');
  });
});
