/**
 * Tests for P30-E: BuilderHistoryDropdown
 *
 * The lightweight history popover that appears in the modal header bar,
 * replacing the dedicated dock panel tab from P19-B.
 *
 * Implementation note: the component uses Mantine Popover with keepMounted=true,
 * so the dropdown content is always present in the DOM. The open/closed state is
 * reflected on the trigger button's aria-expanded attribute.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { BuilderHistoryDropdown, type HistoryEntry } from './BuilderHistoryDropdown';

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

const ENTRIES: HistoryEntry[] = [
  { id: 'h1', label: 'Add slot', timestamp: Date.now() - 3000 },
  { id: 'h2', label: 'Rename template', timestamp: Date.now() - 2000 },
  { id: 'h3', label: 'Move slot', timestamp: Date.now() - 1000 },
];

function renderDropdown(
  overrides: Partial<{
    historyEntries: HistoryEntry[];
    historyCurrentIndex: number;
    isHistoryTrimmed: boolean;
    onJump: (index: number) => void;
  }> = {},
) {
  const defaults = {
    historyEntries: ENTRIES,
    historyCurrentIndex: 2,
    isHistoryTrimmed: false,
    onJump: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return {
    ...render(<BuilderHistoryDropdown {...props} />, { wrapper }),
    onJump: props.onJump as ReturnType<typeof vi.fn>,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BuilderHistoryDropdown (P30-E)', () => {
  it('renders the trigger button', () => {
    renderDropdown();
    expect(screen.getByRole('button', { name: /open history/i })).toBeDefined();
  });

  it('trigger button shows aria-expanded=false when popover is closed', () => {
    renderDropdown();
    const btn = screen.getByRole('button', { name: /open history/i });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the trigger sets aria-expanded to true', () => {
    renderDropdown();
    const btn = screen.getByRole('button', { name: /open history/i });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('history entries are present in the DOM (keepMounted)', () => {
    renderDropdown();
    // keepMounted keeps content in DOM regardless of open state
    expect(screen.getByText('Add slot')).toBeDefined();
    expect(screen.getByText('Rename template')).toBeDefined();
    expect(screen.getByText('Move slot')).toBeDefined();
  });

  it('shows the entry count in the popover header', () => {
    renderDropdown();
    expect(screen.getByText('History (3)')).toBeDefined();
  });

  it('clicking an entry calls onJump with the correct index', () => {
    const onJump = vi.fn();
    renderDropdown({ onJump, historyCurrentIndex: 2 });
    // Use data-testid because the dropdown is aria-hidden in jsdom (floating-ui
    // cannot compute positions without a layout engine).
    const entry = document.querySelector('[data-testid="history-dropdown-entry-1"]') as HTMLElement;
    fireEvent.click(entry);
    expect(onJump).toHaveBeenCalledWith(1);
  });

  it('clicking the "Initial state" sentinel calls onJump(-1)', () => {
    const onJump = vi.fn();
    renderDropdown({ onJump });
    const entry = document.querySelector('[data-testid="history-dropdown-entry-initial"]') as HTMLElement;
    fireEvent.click(entry);
    expect(onJump).toHaveBeenCalledWith(-1);
  });

  it('shows "Oldest state" when isHistoryTrimmed is true', () => {
    renderDropdown({ isHistoryTrimmed: true });
    expect(screen.getByText('Oldest state')).toBeDefined();
  });

  it('shows "Initial state" when isHistoryTrimmed is false', () => {
    renderDropdown({ isHistoryTrimmed: false });
    expect(screen.getByText('Initial state')).toBeDefined();
  });

  it('shows empty state when no history entries', () => {
    renderDropdown({ historyEntries: [] });
    expect(screen.getByText(/No history yet/i)).toBeDefined();
  });

  it('clicking an entry calls onJump and closes the popover', () => {
    const onJump = vi.fn();
    renderDropdown({ onJump });
    // Open first via the trigger
    const triggerBtn = screen.getByRole('button', { name: /open history/i });
    fireEvent.click(triggerBtn);
    expect(triggerBtn.getAttribute('aria-expanded')).toBe('true');
    // Click an entry via data-testid (dropdown is aria-hidden in jsdom)
    const entry = document.querySelector('[data-testid="history-dropdown-entry-2"]') as HTMLElement;
    fireEvent.click(entry);
    expect(onJump).toHaveBeenCalledWith(2);
    // Popover should close after jump
    expect(triggerBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('each history entry has a data-testid reflecting its index', () => {
    renderDropdown({ historyCurrentIndex: 2 });
    // Entries are indexed from 0 (oldest) to N-1 (newest)
    expect(document.querySelector('[data-testid="history-dropdown-entry-2"]')).toBeDefined();
    expect(document.querySelector('[data-testid="history-dropdown-entry-1"]')).toBeDefined();
    expect(document.querySelector('[data-testid="history-dropdown-entry-0"]')).toBeDefined();
  });
});
