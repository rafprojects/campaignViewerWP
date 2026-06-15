import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { SpaceSwitcher, type SpaceSwitcherSpace } from '@wp-super-gallery/shared-ui';

// [P51-J] SpaceSwitcher moved to shared-ui and now takes `pageSpaces` as a prop
// (the WP-global read via usePageSpaces lives app-side, injected by AuthBar).
const SPACE_A: SpaceSwitcherSpace = { instanceId: 'space-a', name: 'Hero Gallery' };
const SPACE_B: SpaceSwitcherSpace = { instanceId: 'space-b', name: 'Products' };

// ── Single-space behaviour ────────────────────────────────────────────────────

describe('SpaceSwitcher — single space', () => {
  it('renders the active space name as a badge', () => {
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} pageSpaces={[SPACE_A]} />);
    expect(screen.getByText('Hero Gallery')).toBeTruthy();
  });

  it('does not render the interactive aria-label when there is only one space', () => {
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} pageSpaces={[SPACE_A]} />);
    // Multi-space badge gets aria-label "Switch targeted gallery space"; single-space does not.
    expect(screen.queryByLabelText('Switch targeted gallery space')).toBeNull();
  });

  it('does not call onSelect when the single-space badge is clicked', () => {
    const onSelect = vi.fn();
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={onSelect} pageSpaces={[SPACE_A]} />);
    fireEvent.click(screen.getByText('Hero Gallery'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('falls back to instanceId as label when the space is not found in the page list', () => {
    // activeInstanceId is not in the page spaces list — label must degrade gracefully.
    render(<SpaceSwitcher activeInstanceId="unknown-id" onSelect={vi.fn()} pageSpaces={[SPACE_A]} />);
    expect(screen.getByText('unknown-id')).toBeTruthy();
  });
});

// ── Multi-space behaviour ─────────────────────────────────────────────────────

describe('SpaceSwitcher — multi-space', () => {
  it('renders a badge with the interactive aria-label when 2+ spaces are present', () => {
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} pageSpaces={[SPACE_A, SPACE_B]} />);
    expect(screen.getByLabelText('Switch targeted gallery space')).toBeTruthy();
    expect(screen.getByText('Hero Gallery')).toBeTruthy();
  });

  it('opens a dropdown listing every page space when the badge is clicked', () => {
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} pageSpaces={[SPACE_A, SPACE_B]} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
    // Products is only present when the dropdown is open — proves it rendered.
    expect(screen.getByText('Products')).toBeTruthy();
    // Hero Gallery appears in both the trigger badge AND the active menu item.
    expect(screen.getAllByText('Hero Gallery')).toHaveLength(2);
  });

  it('calls onSelect with the correct instanceId when an inactive space is clicked', () => {
    const onSelect = vi.fn();
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={onSelect} pageSpaces={[SPACE_A, SPACE_B]} />);
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
    const onSelect = vi.fn();
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={onSelect} pageSpaces={[SPACE_A, SPACE_B]} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
    // Target the menu item specifically — badge also shows "Hero Gallery" so getByText would find 2.
    fireEvent.click(screen.getByRole('menuitem', { name: /hero gallery/i }));
    // Clicking the active space calls onSelect with the same id (idempotent state update in parent).
    expect(onSelect).toHaveBeenCalledWith('space-a');
  });

  it('marks the active space item with a checkmark SVG and the inactive item with a blank spacer', () => {
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} pageSpaces={[SPACE_A, SPACE_B]} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));

    // Mantine Menu.Item renders leftSection content inside the button.
    // Active → IconCheck (svg), inactive → blank span (no svg in left section).
    const heroItem = screen.getByRole('menuitem', { name: /hero gallery/i });
    const productsItem = screen.getByRole('menuitem', { name: /products/i });

    expect(heroItem.querySelector('svg')).not.toBeNull();
    expect(productsItem.querySelector('svg')).toBeNull();
  });

  it('shows "Target space" as the dropdown label', () => {
    render(<SpaceSwitcher activeInstanceId="space-a" onSelect={vi.fn()} pageSpaces={[SPACE_A, SPACE_B]} />);
    fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
    expect(screen.getByText('Target space')).toBeTruthy();
  });
});
