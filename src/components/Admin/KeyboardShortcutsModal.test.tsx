import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
  it('renders nothing when closed', () => {
    render(<KeyboardShortcutsModal opened={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('renders shortcut sections when opened', () => {
    render(<KeyboardShortcutsModal opened onClose={vi.fn()} />);
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
  });

  it('renders shortcut descriptions', () => {
    render(<KeyboardShortcutsModal opened onClose={vi.fn()} />);
    expect(screen.getByText(/open keyboard shortcuts help/i)).toBeInTheDocument();
    expect(screen.getByText(/new campaign/i)).toBeInTheDocument();
    expect(screen.getByText(/import campaign/i)).toBeInTheDocument();
    expect(screen.getByText(/toggle bulk select/i)).toBeInTheDocument();
  });

  it('renders macOS hint text', () => {
    render(<KeyboardShortcutsModal opened onClose={vi.fn()} />);
    expect(screen.getByText(/macOS/i)).toBeInTheDocument();
  });

  it('calls onClose when modal close button is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal opened onClose={onClose} />);
    // Mantine Modal escape key is handled on the overlay element
    const overlay = document.querySelector('[data-modal-overlay], .mantine-Modal-overlay, [class*="Modal-overlay"]') as HTMLElement
      ?? document.querySelector('[data-portal]') as HTMLElement;
    const target = overlay ?? document.body;
    fireEvent.keyDown(target, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
