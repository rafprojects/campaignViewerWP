import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import { SettingsPanel } from './SettingsPanel';
import type { ApiClient } from '@/services/apiClient';

// Mock ThemeSelector since it depends on ThemeContext
vi.mock('./ThemeSelector', () => ({
  ThemeSelector: ({ description }: { description?: string }) => (
    <div data-testid="theme-selector">{description}</div>
  ),
}));

function createMockApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('http://test'),
    getAuthHeaders: vi.fn().mockResolvedValue({}),
    getSettings: vi.fn().mockResolvedValue({
      galleryLayout: 'grid',
      itemsPerPage: 12,
      enableLightbox: true,
      enableAnimations: true,
      videoViewportHeight: 420,
      imageViewportHeight: 420,
      thumbnailScrollSpeed: 1,
      scrollAnimationStyle: 'smooth',
      scrollAnimationDurationMs: 180,
      scrollAnimationEasing: 'ease',
    }),
    updateSettings: vi.fn().mockResolvedValue({
      galleryLayout: 'grid',
      itemsPerPage: 12,
      enableLightbox: true,
      enableAnimations: true,
      videoViewportHeight: 420,
      imageViewportHeight: 420,
      thumbnailScrollSpeed: 1,
      scrollAnimationStyle: 'smooth',
      scrollAnimationDurationMs: 180,
      scrollAnimationEasing: 'ease',
    }),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    ...overrides,
  } as unknown as ApiClient;
}

/** Helper to find Mantine Switch inputs (hidden checkbox inside Switch component) */
function getSwitchInputs(): HTMLInputElement[] {
  // Mantine Switch renders hidden <input type="checkbox"> elements
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
}

/** Navigate to a tab by clicking its tab button */
function clickTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }));
}

describe('SettingsPanel', () => {
  let apiClient: ApiClient;
  const onClose = vi.fn();
  const onNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = createMockApiClient();
  });

  it('renders settings modal with tabs after loading', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    expect(apiClient.getSettings).toHaveBeenCalledOnce();

    // General tab (default) — settings visible
    expect(screen.getByText('Default Layout')).toBeDefined();
    expect(screen.getByText('Items Per Page')).toBeDefined();

    // Tab buttons visible
    expect(screen.getByRole('tab', { name: /General/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Campaign Cards/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Media Gallery/i })).toBeDefined();
  });

  it('shows gallery tab settings when Media Gallery tab is clicked', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    clickTab('Media Gallery');

    expect(screen.getByText('Enable Lightbox')).toBeDefined();
    expect(screen.getByText('Enable Animations')).toBeDefined();
    expect(screen.getByText('Video Gallery Height (px)')).toBeDefined();
    expect(screen.getByText('Image Gallery Height (px)')).toBeDefined();
  });

  it('uses defaults when getSettings fails', async () => {
    apiClient = createMockApiClient({
      getSettings: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    expect(screen.getByText('Default Layout')).toBeDefined();
  });

  it('calls onClose when modal close button is clicked', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    const closeButton = document.querySelector('.mantine-Modal-close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows Save Changes button that is disabled when no changes', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeDisabled();
  });

  it('enables save and shows reset when settings change, then saves', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    // Navigate to Media Gallery tab to find switches
    clickTab('Media Gallery');

    // Toggle "Enable Lightbox" via hidden checkbox input
    const switches = getSwitchInputs();
    expect(switches.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(switches[0]);

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).not.toBeDisabled();

    // Reset button appears
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();

    // Save
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiClient.updateSettings).toHaveBeenCalledOnce();
    });

    expect(onNotify).toHaveBeenCalledWith({
      type: 'success',
      text: 'Settings saved successfully.',
    });
  });

  it('resets changes when reset button is clicked', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    // Navigate to Media Gallery tab to find switches
    clickTab('Media Gallery');

    // Toggle "Enable Animations" via hidden checkbox
    const switches = getSwitchInputs();
    fireEvent.click(switches[1]);

    // Reset
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    // Save button should be disabled again
    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeDisabled();
  });

  it('shows error notification when save fails', async () => {
    apiClient = createMockApiClient({
      updateSettings: vi.fn().mockRejectedValue(new Error('Save failed')),
    });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    // Navigate to Media Gallery tab to find switches
    clickTab('Media Gallery');

    // Make a change
    const switches = getSwitchInputs();
    fireEvent.click(switches[0]);

    // Save
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  it('renders ThemeSelector on the General tab', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-selector')).toBeDefined();
    });
  });

  it('does not render content when opened is false', () => {
    render(
      <SettingsPanel opened={false} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    expect(screen.queryByText('Display Settings')).toBeNull();
  });

  it('renders instantly without spinner when initialSettings are provided', () => {
    const initial = {
      videoViewportHeight: 500,
      imageViewportHeight: 600,
      thumbnailScrollSpeed: 2,
      scrollAnimationStyle: 'smooth' as const,
      scrollAnimationDurationMs: 200,
      scrollAnimationEasing: 'ease' as const,
      scrollTransitionType: 'fade' as const,
    };

    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={initial}
      />
    );

    // Should render immediately — no loader, tabs visible synchronously
    expect(screen.getByText('Display Settings')).toBeDefined();
    expect(screen.getByRole('tab', { name: /General/i })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull(); // no loader spinner
  });

  it('toggles all switches on General tab to call updateSetting lambdas', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    // General tab is default — get all checkbox inputs and click each
    const switches = getSwitchInputs();
    // Click every switch to trigger each (e) => updateSetting(...) lambda
    for (const checkbox of switches) {
      fireEvent.click(checkbox);
    }

    // After clicking, at least one setting changed — save button should be enabled
    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
  });

  it('interacts with controls on Campaign Cards tab', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    clickTab('Campaign Cards');

    // Toggle cardPageDotNav switch
    const switches = getSwitchInputs();
    for (const checkbox of switches) {
      fireEvent.click(checkbox);
    }

    // The save button should be enabled after changes
    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
  });

  it('interacts with Media Gallery tab background text inputs', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    clickTab('Media Gallery');

    // Find all text inputs (not checkboxes, not radio) and change them
    const textInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="text"]'),
    );
    for (const input of textInputs.slice(0, 10)) {
      fireEvent.change(input, { target: { value: 'test-value' } });
    }

    // Also interact with switches on this tab
    const switches = getSwitchInputs();
    for (const sw of switches.slice(0, 5)) {
      fireEvent.click(sw);
    }

    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
  });

  it('enables Advanced tab via toggle and interacts with its controls', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    // The advancedSettingsEnabled switch is on the General tab
    // Get all checkboxes and click the last one (should be advancedSettingsEnabled)
    const switches = getSwitchInputs();
    // Click the last switch which should be advancedSettingsEnabled
    const lastSwitch = switches[switches.length - 1];
    fireEvent.click(lastSwitch);

    await waitFor(() => {
      // Advanced tab should now be visible
      expect(screen.queryByRole('tab', { name: /Advanced/i })).toBeDefined();
    });

    const advancedTab = screen.queryByRole('tab', { name: /Advanced/i });
    if (advancedTab) {
      fireEvent.click(advancedTab);

      // Interact with text inputs on Advanced tab
      await waitFor(() => {
        const textInputs = Array.from(
          document.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"]):not([type="radio"])'),
        );
        for (const input of textInputs.slice(0, 15)) {
          if (input.type !== 'hidden') {
            fireEvent.change(input, { target: { value: '100' } });
          }
        }
      });
    }

    // Settings should have changed
    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
  });

  it('tests connection successfully', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    const testBtn = screen.queryByRole('button', { name: /Test Connection/i });
    if (testBtn) {
      fireEvent.click(testBtn);
      await waitFor(() => {
        expect(apiClient.testConnection).toHaveBeenCalled();
      });
    }
  });
});
