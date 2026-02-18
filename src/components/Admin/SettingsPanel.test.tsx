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

describe('SettingsPanel', () => {
  let apiClient: ApiClient;
  const onClose = vi.fn();
  const onNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = createMockApiClient();
  });

  it('renders settings after loading', async () => {
    render(
      <SettingsPanel apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    expect(apiClient.getSettings).toHaveBeenCalledOnce();
    expect(screen.getByText('Default Layout')).toBeDefined();
    expect(screen.getByText('Items Per Page')).toBeDefined();
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
      <SettingsPanel apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    expect(screen.getByText('Default Layout')).toBeDefined();
  });

  it('calls onClose when back button is clicked', async () => {
    render(
      <SettingsPanel apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Back to gallery'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows Save Changes button that is disabled when no changes', async () => {
    render(
      <SettingsPanel apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeDisabled();
  });

  it('enables save and shows reset when settings change, then saves', async () => {
    render(
      <SettingsPanel apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

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
      <SettingsPanel apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

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
      <SettingsPanel apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByText('Display Settings')).toBeDefined();
    });

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

  it('renders ThemeSelector', async () => {
    render(
      <SettingsPanel apiClient={apiClient} onClose={onClose} onNotify={onNotify} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-selector')).toBeDefined();
    });
  });
});
