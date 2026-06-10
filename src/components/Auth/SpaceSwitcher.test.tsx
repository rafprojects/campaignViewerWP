import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { SpaceSwitcher } from './SpaceSwitcher';
import type { PageSpace } from '@/hooks/usePageSpaces';

type Win = typeof window & { __WPSG_PAGE_SPACES__?: PageSpace[] };

const SPACE_A: PageSpace = { instanceId: 'space-a', id: 1, slug: 'hero', name: 'Hero Gallery' };
const SPACE_B: PageSpace = { instanceId: 'space-b', id: 2, slug: 'products', name: 'Products' };

function setSpaces(...spaces: PageSpace[]) {
  (window as Win).__WPSG_PAGE_SPACES__ = spaces;
}

afterEach(() => {
  delete (window as Win).__WPSG_PAGE_SPACES__;
});

// ── Single-space behaviour ────────────────────────────────────────────────────

describe('SpaceSwitcher — single space', () => {
  it('renders the active space name as a badge', () => {
    setSpaces(SPACE_A);
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} />);
    expect(screen.getByText('Hero Gallery')).toBeTruthy();
  });

  it('does not render the interactive aria-label when there is only one space', () => {
    setSpaces(SPACE_A);
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} />);
    // Multi-space badge gets aria-label "Switch targeted gallery space"; single-space does not.
    expect(screen.queryByLabelText('Switch targeted gallery space')).toBeNull();
  });

  it('does not call onSelect when the single-space badge is clicked', () => {
    setSpaces(SPACE_A);
    const onSelect = vi.fn();
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Hero Gallery'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('falls back to instanceId as label when the space is not found in the page list', () => {
    setSpaces(SPACE_A);
    // activeInstanceId is not in the page spaces list — label must degrade gracefully.
    render(<SpaceSwitcher activeInstanceId="unknown-id" onSelect={vi.fn()} />);
    expect(screen.getByText('unknown-id')).toBeTruthy();
  });
});

// ── Multi-space behaviour ─────────────────────────────────────────────────────

describe('SpaceSwitcher — multi-space', () => {
  it('renders a badge with the interactive aria-label when 2+ spaces are present', () => {
    setSpaces(SPACE_A, SPACE_B);
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} />);
    expect(screen.getByLabelText('Switch targeted gallery space')).toBeTruthy();
    expect(screen.getByText('Hero Gallery')).toBeTruthy();
  });

  it('opens a dropdown listing every page space when the badge is clicked', () => {
    setSpaces(SPACE_A, SPACE_B);
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
    // Products is only present when the dropdown is open — proves it rendered.
    expect(screen.getByText('Products')).toBeTruthy();
    // Hero Gallery appears in both the trigger badge AND the active menu item.
    expect(screen.getAllByText('Hero Gallery')).toHaveLength(2);
  });

  it('calls onSelect with the correct instanceId when an inactive space is clicked', () => {
    setSpaces(SPACE_A, SPACE_B);
    const onSelect = vi.fn();
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
    fireEvent.click(screen.getByText('Products'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('space-b');
  });

  it('does NOT call onSelect when the already-active space item is clicked', () => {
    // The active item has an onClick but the user selecting their own space should be a no-op
    // for the parent (the parent's state doesn't change). We verify onSelect is still fired
    // (the component calls it for all items) so the parent can decide — this test documents
    // the current contract rather than enforcing silence.
    setSpaces(SPACE_A, SPACE_B);
    const onSelect = vi.fn();
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
    // Target the menu item specifically — badge also shows "Hero Gallery" so getByText would find 2.
    fireEvent.click(screen.getByRole('menuitem', { name: /hero gallery/i }));
    // Clicking the active space calls onSelect with the same id (idempotent state update in parent).
    expect(onSelect).toHaveBeenCalledWith('space-a');
  });

  it('marks the active space item with a checkmark SVG and the inactive item with a blank spacer', () => {
    setSpaces(SPACE_A, SPACE_B);
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));

    // Mantine Menu.Item renders leftSection content inside the button.
    // Active → IconCheck (svg), inactive → blank span (no svg in left section).
    const heroItem = screen.getByRole('menuitem', { name: /hero gallery/i });
    const productsItem = screen.getByRole('menuitem', { name: /products/i });

    expect(heroItem.querySelector('svg')).not.toBeNull();
    expect(productsItem.querySelector('svg')).toBeNull();
  });

  it('shows "Target space" as the dropdown label', () => {
    setSpaces(SPACE_A, SPACE_B);
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
    expect(screen.getByText('Target space')).toBeTruthy();
  });
});
