import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import type { ShortcutConfigHandle } from '@/hooks/useShortcutConfig';
import { ACTION_DEFAULTS } from '@/hooks/useShortcutConfig';

function makeConfig(overrides: Partial<ShortcutConfigHandle> = {}): ShortcutConfigHandle {
  return {
    effectiveMap: {
      openHelp: '?',
      newCampaign: 'mod+n',
      importJson: 'mod+i',
      bulkSelect: 'mod+shift+a',
    },
    actionDefs: ACTION_DEFAULTS,
    hasCustomizations: false,
    updateShortcut: vi.fn().mockReturnValue(null),
    resetToDefaults: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

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
    expect(screen.getByText(/select all \/ deselect all/i)).toBeInTheDocument();
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

  describe('with config prop', () => {
    it('shows "Edit shortcuts" button when config is provided', () => {
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={makeConfig()} />);
      expect(screen.getByRole('button', { name: /edit shortcuts/i })).toBeInTheDocument();
    });

    it('does not show "Edit shortcuts" button without config prop', () => {
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /edit shortcuts/i })).not.toBeInTheDocument();
    });

    it('shows effective key bindings from config', () => {
      const config = makeConfig({
        effectiveMap: { ...makeConfig().effectiveMap, newCampaign: 'mod+m' },
        hasCustomizations: true,
      });
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={config} />);
      // mod+m → displayed as CTRL+M or ⌘+M
      expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('shows "customized" badge when hasCustomizations is true', () => {
      const config = makeConfig({ hasCustomizations: true });
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={config} />);
      expect(screen.getByText(/customized/i)).toBeInTheDocument();
    });

    it('enters edit mode when "Edit shortcuts" button is clicked', () => {
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={makeConfig()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit shortcuts/i }));
      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });

    it('shows remap buttons for each configurable action in edit mode', () => {
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={makeConfig()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit shortcuts/i }));
      const remapButtons = screen.getAllByRole('button', { name: /remap/i });
      expect(remapButtons.length).toBeGreaterThan(0);
    });

    it('shows "Reset all to defaults" button in edit mode when customizations exist', () => {
      const config = makeConfig({ hasCustomizations: true });
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={config} />);
      fireEvent.click(screen.getByRole('button', { name: /edit shortcuts/i }));
      expect(screen.getByRole('button', { name: /reset all to defaults/i })).toBeInTheDocument();
    });

    it('does not show "Reset all to defaults" button when no customizations exist', () => {
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={makeConfig()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit shortcuts/i }));
      expect(screen.queryByRole('button', { name: /reset all to defaults/i })).not.toBeInTheDocument();
    });

    it('calls resetToDefaults when "Reset all to defaults" button is clicked', () => {
      const config = makeConfig({ hasCustomizations: true });
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={config} />);
      fireEvent.click(screen.getByRole('button', { name: /edit shortcuts/i }));
      fireEvent.click(screen.getByRole('button', { name: /reset all to defaults/i }));
      expect(config.resetToDefaults).toHaveBeenCalled();
    });

    it('exits edit mode and resets state when "Done" is clicked', () => {
      render(<KeyboardShortcutsModal opened onClose={vi.fn()} config={makeConfig()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit shortcuts/i }));
      fireEvent.click(screen.getByRole('button', { name: /done/i }));
      expect(screen.getByRole('button', { name: /edit shortcuts/i })).toBeInTheDocument();
    });
  });
});
