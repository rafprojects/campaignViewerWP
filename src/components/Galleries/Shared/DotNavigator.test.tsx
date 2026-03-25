import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import { DotNavigator } from './DotNavigator';
import type { GalleryBehaviorSettings } from '@/types';

const BASE_SETTINGS: GalleryBehaviorSettings = {
  dotNavEnabled: true,
  dotNavPosition: 'below',
  dotNavSize: 10,
  dotNavActiveColor: '#ffffff',
  dotNavInactiveColor: 'rgba(128,128,128,0.4)',
  dotNavShape: 'circle',
  dotNavSpacing: 6,
  dotNavActiveScale: 1.3,
} as unknown as GalleryBehaviorSettings;

describe('DotNavigator', () => {
  it('returns null when dotNavEnabled is false', () => {
    render(
      <DotNavigator
        total={5}
        currentIndex={0}
        onSelect={vi.fn()}
        settings={{ ...BASE_SETTINGS, dotNavEnabled: false }}
      />,
    );
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('returns null when total <= 1', () => {
    render(
      <DotNavigator
        total={1}
        currentIndex={0}
        onSelect={vi.fn()}
        settings={BASE_SETTINGS}
      />,
    );
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('renders correct number of dots for total <= 7', () => {
    render(
      <DotNavigator
        total={4}
        currentIndex={1}
        onSelect={vi.fn()}
        settings={BASE_SETTINGS}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
  });

  it('calls onSelect with correct index on dot click', () => {
    const onSelect = vi.fn();
    render(
      <DotNavigator
        total={3}
        currentIndex={0}
        onSelect={onSelect}
        settings={BASE_SETTINGS}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[2]);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('marks the active dot with aria-selected=true', () => {
    render(
      <DotNavigator
        total={3}
        currentIndex={1}
        onSelect={vi.fn()}
        settings={BASE_SETTINGS}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('renders truncated dots with ellipsis for total > 7', () => {
    const { container } = render(
      <DotNavigator
        total={15}
        currentIndex={7}
        onSelect={vi.fn()}
        settings={BASE_SETTINGS}
      />,
    );
    // Should have fewer than 15 buttons (truncation active)
    const tabs = screen.queryAllByRole('tab');
    expect(tabs.length).toBeLessThan(15);
    // Should have at least one ellipsis element
    expect(container.textContent).toContain('…');
  });

  it('positions as overlay-bottom when dotNavPosition is overlay-bottom', () => {
    render(
      <DotNavigator
        total={3}
        currentIndex={0}
        onSelect={vi.fn()}
        settings={{ ...BASE_SETTINGS, dotNavPosition: 'overlay-bottom' }}
      />,
    );
    const wrapper = screen.getByRole('tablist') as HTMLElement;
    expect(wrapper.style.position).toBe('absolute');
    expect(wrapper.style.bottom).toBe('8px');
  });

  it('positions at top when dotNavPosition is overlay-top', () => {
    render(
      <DotNavigator
        total={3}
        currentIndex={0}
        onSelect={vi.fn()}
        settings={{ ...BASE_SETTINGS, dotNavPosition: 'overlay-top' }}
      />,
    );
    const wrapper = screen.getByRole('tablist') as HTMLElement;
    expect(wrapper.style.position).toBe('absolute');
    expect(wrapper.style.top).toBe('8px');
  });

  it('renders pill-shaped dots when dotNavShape is pill', () => {
    render(
      <DotNavigator
        total={3}
        currentIndex={0}
        onSelect={vi.fn()}
        settings={{ ...BASE_SETTINGS, dotNavShape: 'pill' }}
      />,
    );
    // Just verify it renders without errors
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('renders square dots when dotNavShape is square', () => {
    render(
      <DotNavigator
        total={3}
        currentIndex={0}
        onSelect={vi.fn()}
        settings={{ ...BASE_SETTINGS, dotNavShape: 'square' }}
      />,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
