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
    expect(screen.getByRole('tab', { name: /Gallery/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Transitions/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Navigation/i })).toBeDefined();
  });

  it('shows gallery tab settings when Gallery tab is clicked', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    clickTab('Gallery');

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

    // Navigate to Gallery tab to find switches
    clickTab('Gallery');

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

    // Navigate to Gallery tab to find switches
    clickTab('Gallery');

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

    // Navigate to Gallery tab to find switches
    clickTab('Gallery');

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
});
