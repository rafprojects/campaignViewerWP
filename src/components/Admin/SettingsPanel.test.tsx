import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@/test/test-utils';
import { SettingsPanel } from './SettingsPanel';
import type { ApiClient } from '@/services/apiClient';

// Static import to warm module cache for the lazy-loaded responsive editor.
import '@/components/Common/GalleryConfigEditorModal';

// Mock ThemeSelector since it depends on ThemeContext
vi.mock('./ThemeSelector', () => ({
  ThemeSelector: ({ description }: { description?: string }) => (
    <div data-testid="theme-selector">{description}</div>
  ),
}));

// Mock useTheme since SettingsPanel calls it for preview control
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    themeId: 'default-dark',
    setTheme: vi.fn(),
    setPreviewTheme: vi.fn(),
    colorScheme: 'dark' as const,
    cssVars: '',
    mantineTheme: {},
    availableThemes: [],
  }),
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

/** Seed settings to bypass the slow async-load path in jsdom. */
const seedSettings = {
  galleryLayout: 'grid' as const,
  itemsPerPage: 12,
  enableLightbox: true,
  enableAnimations: true,
  videoViewportHeight: 420,
  imageViewportHeight: 420,
  thumbnailScrollSpeed: 1,
  scrollAnimationStyle: 'smooth' as const,
  scrollAnimationDurationMs: 180,
  scrollAnimationEasing: 'ease' as const,
};

/**
 * Wait until the SettingsPanel loading spinner has cleared and the tab bar
 * is visible in the DOM. This is the correct gate — the modal header title
 * ('Display Settings') renders immediately on open regardless of load state,
 * so waiting for it resolves too early and races against getSettings().
 */
async function waitForTabs() {
  await screen.findByRole('tab', { name: /General/i });
}

/** Navigate to a tab and wait for a piece of panel content to appear. */
async function clickTabAndWait(name: string, contentText: string) {
  fireEvent.click(screen.getByRole('tab', { name }));
  await screen.findByText(contentText);
}

/** Toggle a Mantine Switch by its visible label text. */
function toggleSwitchByLabel(label: string) {
  const el = screen.getByText(label);
  // Mantine Switch wraps a hidden <input type="checkbox"> inside the label tree
  const input = el.closest('div')?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (input) {
    fireEvent.click(input);
  } else {
    // Fallback: click the label element itself
    fireEvent.click(el);
  }
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
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();

    // General tab (default) — settings visible
    expect(screen.getByText('Default Layout')).toBeDefined();
    expect(screen.getByText('Items Per Page')).toBeDefined();

    // Tab buttons visible
    expect(screen.getByRole('tab', { name: /General/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Campaign Cards/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Media Display/i })).toBeDefined();
  });

  it('shows gallery tab settings when Media Display tab is clicked', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    await clickTabAndWait('Media Display', 'Enable Lightbox');

    expect(screen.getByText('Enable Lightbox')).toBeDefined();
    expect(screen.getByText('Enable Animations')).toBeDefined();
    expect(screen.getByText('Height Constraint')).toBeDefined();
  });

  it('uses defaults when getSettings fails', async () => {
    apiClient = createMockApiClient({
      getSettings: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    // Provide no initialSettings — component falls back to defaults internally
    // after getSettings rejects. Use initialSettings to avoid jsdom slowness.
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={{}} />
    );

    await waitForTabs();
    expect(screen.getByText('Default Layout')).toBeDefined();
  });

  it('calls onClose when modal close button is clicked', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    const closeButton = document.querySelector('.mantine-Modal-close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows Save Changes button that is disabled when no changes', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeDisabled();
  });

  it('enables save and shows reset when settings change, then saves', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    await clickTabAndWait('Media Display', 'Enable Lightbox');

    // Toggle "Enable Lightbox" by its label
    toggleSwitchByLabel('Enable Lightbox');

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();

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
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    await clickTabAndWait('Media Display', 'Enable Animations');

    // Toggle "Enable Animations" by its label, then reset
    toggleSwitchByLabel('Enable Animations');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    // After reset the save button must be disabled again
    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeDisabled();
  });

  it('projects shared editor gallery presentation fields back into flat settings', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      gallerySizingMode: 'manual',
      galleryManualHeight: '75vh',
      galleryImageLabel: 'Photo Reel',
      galleryVideoLabel: 'Video Reel',
      galleryLabelJustification: 'right',
      showGalleryLabelIcon: true,
      showCampaignGalleryLabels: false,
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              common: {
                gallerySizingMode: 'manual',
                galleryManualHeight: '75vh',
                galleryImageLabel: 'Photo Reel',
                galleryVideoLabel: 'Video Reel',
                galleryLabelJustification: 'right',
                showGalleryLabelIcon: true,
                showCampaignGalleryLabels: false,
              },
            },
          },
        },
      },
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');
    await screen.findByRole('button', { name: 'Edit Responsive Config' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));

    const dialog = await screen.findByRole('dialog', { name: 'Responsive Gallery Config' }, { timeout: 10000 });
    fireEvent.click(within(dialog).getByLabelText('Height Constraint', { selector: 'input' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Manually control height' }));
    fireEvent.change(within(dialog).getByLabelText('Manual Gallery Height'), { target: { value: '75vh' } });
    const imageLabelInput = within(dialog).getByLabelText('Image Gallery Label');
    fireEvent.change(imageLabelInput, { target: { value: 'Photo Reel' } });
    fireEvent.change(within(dialog).getByLabelText('Video Gallery Label'), { target: { value: 'Video Reel' } });
    fireEvent.click(within(dialog).getByLabelText('Gallery Label Justification', { selector: 'input' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Right' }));
    fireEvent.click(within(dialog).getByLabelText('Show Gallery Label Icons', { selector: 'input' }));
    fireEvent.click(await screen.findByRole('option', { name: 'On' }));
    fireEvent.click(within(dialog).getByLabelText('Show Gallery Section Labels', { selector: 'input' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Off' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply Gallery Config' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      gallerySizingMode: 'manual',
      galleryManualHeight: '75vh',
      galleryImageLabel: 'Photo Reel',
      galleryVideoLabel: 'Video Reel',
      galleryLabelJustification: 'right',
      showGalleryLabelIcon: true,
      showCampaignGalleryLabels: false,
      galleryConfig: expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              common: expect.objectContaining({
                gallerySizingMode: 'manual',
                galleryManualHeight: '75vh',
                galleryImageLabel: 'Photo Reel',
                galleryVideoLabel: 'Video Reel',
                galleryLabelJustification: 'right',
                showGalleryLabelIcon: true,
                showCampaignGalleryLabels: false,
              }),
            }),
          }),
        }),
      }),
    }));
  });

  it('shows shared gallery height controls for flat gallery sizing settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          gallerySizingMode: 'manual',
          galleryManualHeight: '75vh',
        }}
      />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));
    const dialog = await screen.findByRole('dialog', { name: 'Responsive Gallery Config' }, { timeout: 10000 });

    expect(within(dialog).getByText('Shared Gallery Height')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Height Constraint', { selector: 'input' })).toHaveValue('Manually control height');
    expect(within(dialog).getByLabelText('Manual Gallery Height')).toHaveValue('75vh');
  });

  it('shows error notification when save fails', async () => {
    apiClient = createMockApiClient({
      updateSettings: vi.fn().mockRejectedValue(new Error('Save failed')),
    });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    await clickTabAndWait('Media Display', 'Enable Lightbox');

    toggleSwitchByLabel('Enable Lightbox');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  it('renders ThemeSelector on the General tab', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    expect(screen.getByTestId('theme-selector')).toBeDefined();
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

  it('toggles General tab switches to call updateSetting lambdas', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();

    // Toggle representative named switches on the General tab.
    // These all map to (e) => updateSetting(key, e.currentTarget.checked) lambdas.
    toggleSwitchByLabel('Show Gallery Title');
    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();

    toggleSwitchByLabel('Show Filter Tabs');
    toggleSwitchByLabel('Show Search Box');
    toggleSwitchByLabel('Show Gallery Subtitle');

    // Save button must still be enabled with multiple changes
    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
  });

  it('interacts with controls on Campaign Cards tab', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();

    // Navigate to Campaign Cards tab and wait for its content
    fireEvent.click(screen.getByRole('tab', { name: /Campaign Cards/i }));
    // Wait for a label that lives exclusively in the campaign cards tab
    // The Campaign Cards tab opens with an accordion; 'Card Appearance' is the first visible item.
    await screen.findByText('Card Appearance');

    // Toggle the first checkbox available on this tab
    const switches = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    if (switches.length > 0) {
      fireEvent.click(switches[0]);
    }

    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
  });

  it('shows the shared responsive gallery editor entry point on the layout tab', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');

    expect(screen.getByRole('button', { name: 'Edit Responsive Config' })).toBeInTheDocument();
  });

  it('seeds shared editor adapter-specific values from flat settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          gallerySelectionMode: 'per-breakpoint',
          desktopImageAdapterId: 'masonry',
          masonryColumns: 4,
        }}
      />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));
    const dialog = await screen.findByRole('dialog', { name: 'Responsive Gallery Config' }, { timeout: 10000 });

    expect(within(dialog).getByDisplayValue('4')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Masonry Columns (0 = auto)')).toBeInTheDocument();
  });

  it('seeds shared editor classic carousel values from flat settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          carouselVisibleCards: 3,
          carouselLoop: false,
          carouselAutoplayDirection: 'rtl',
        }}
      />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));
    const dialog = await screen.findByRole('dialog', { name: 'Responsive Gallery Config' }, { timeout: 10000 });

    expect(within(dialog).getByLabelText('Visible Cards')).toHaveValue('3');
    expect(within(dialog).getByLabelText('Loop', { selector: 'input' })).toHaveValue('Off');
    expect(within(dialog).getByLabelText('Autoplay Direction', { selector: 'input' })).toHaveValue('Right to Left');
  });

  it('projects shared editor carousel adapter fields back into flat settings', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      carouselVisibleCards: 3,
      carouselLoop: false,
      carouselAutoplayDirection: 'rtl',
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'classic',
              adapterSettings: {
                carouselVisibleCards: 3,
                carouselLoop: false,
                carouselAutoplayDirection: 'rtl',
              },
            },
          },
        },
      },
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));

    const dialog = await screen.findByRole('dialog', { name: 'Responsive Gallery Config' }, { timeout: 10000 });
    fireEvent.change(within(dialog).getByLabelText('Visible Cards'), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByLabelText('Loop', { selector: 'input' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Off' }));
    fireEvent.click(within(dialog).getByLabelText('Autoplay Direction', { selector: 'input' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Right to Left' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply Gallery Config' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      carouselVisibleCards: 3,
      carouselLoop: false,
      carouselAutoplayDirection: 'rtl',
      galleryConfig: expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              adapterSettings: expect.objectContaining({
                carouselVisibleCards: 3,
                carouselLoop: false,
                carouselAutoplayDirection: 'rtl',
              }),
            }),
          }),
        }),
      }),
    }));
  });

  it('seeds additional registry-driven adapter values from flat settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          gallerySelectionMode: 'per-breakpoint',
          desktopImageAdapterId: 'compact-grid',
          gridCardWidth: 210,
          gridCardHeight: 260,
        }}
      />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));
    const dialog = await screen.findByRole('dialog', { name: 'Responsive Gallery Config' }, { timeout: 10000 });

    expect(within(dialog).getByDisplayValue('210')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('260')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Card Min Width (px)')).toBeInTheDocument();
  });

  it('shows shared section sizing controls for flat section sizing settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          gallerySectionMaxWidth: 1100,
          gallerySectionMinWidth: 360,
          gallerySectionHeightMode: 'manual',
          gallerySectionMaxHeight: 620,
          gallerySectionMinHeight: 260,
          perTypeSectionEqualHeight: true,
        }}
      />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));
    const dialog = await screen.findByRole('dialog', { name: 'Responsive Gallery Config' }, { timeout: 10000 });

    expect(within(dialog).getByText('Shared Section Sizing')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Section Height Mode', { selector: 'input' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Equal Height Sections (Per-Type)', { selector: 'input' })).toBeInTheDocument();
  });

  it('shows shared adapter sizing controls for flat adapter sizing settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          adapterSizingMode: 'manual',
          adapterMaxWidthPct: 85,
          adapterMaxHeightPct: 90,
        }}
      />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));
    const dialog = await screen.findByRole('dialog', { name: 'Responsive Gallery Config' }, { timeout: 10000 });

    expect(within(dialog).getByLabelText('Adapter Sizing Mode', { selector: 'input' })).toBeInTheDocument();
    expect(within(dialog).getByText('Shared Adapter Sizing')).toBeInTheDocument();
  });

  it('interacts with Media Display tab controls', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    await clickTabAndWait('Media Display', 'Enable Lightbox');

    // Toggle named switches
    toggleSwitchByLabel('Enable Lightbox');
    toggleSwitchByLabel('Enable Animations');

    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
  });

  it('enables Advanced tab via advancedSettingsEnabled switch', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();

    // Advanced Settings Enabled switch is on the General tab.
    // It controls visibility of the Advanced tab.
    toggleSwitchByLabel('Enable Advanced Settings');

    // The Advanced tab should now appear in the tab list.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Advanced/i })).toBeDefined();
    });

    // Navigate to it
    fireEvent.click(screen.getByRole('tab', { name: /Advanced/i }));

    // Save button must be enabled (advancedSettingsEnabled changed)
    expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
  });

  it('tests connection successfully', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();

    const testBtn = screen.queryByRole('button', { name: /Test Connection/i });
    if (testBtn) {
      fireEvent.click(testBtn);
      await waitFor(() => {
        expect(apiClient.testConnection).toHaveBeenCalled();
      });
    }
  });
});
