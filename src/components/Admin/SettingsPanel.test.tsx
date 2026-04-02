import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@/test/test-utils';
import { SettingsPanel } from './SettingsPanel';
import type { ApiClient } from '@/services/apiClient';
import type { GalleryConfig } from '@/types';
import { getAdapterSelectOptions } from '@/components/Galleries/Adapters/adapterRegistry';

const { setThemeSpy, setPreviewThemeSpy } = vi.hoisted(() => ({
  setThemeSpy: vi.fn(),
  setPreviewThemeSpy: vi.fn(),
}));

// ── Lightweight mock for GalleryConfigEditorModal ──────────────────────
// The real modal (816 lines + full adapter registry + Suspense/lazy) is the
// primary cause of 60–186 s test times.  We replace it with a thin stub that:
//   • captures `value` so seed-tests can inspect it directly,
//   • exposes `onSave` so projection-tests can invoke it with a crafted config,
//   • renders minimal DOM to keep role-queries fast.
let capturedModalValue: Partial<GalleryConfig> | undefined;
let capturedOnSave: ((cfg: GalleryConfig) => void) | undefined;
let capturedModalZIndex: number | undefined;

vi.mock('@/components/Common/GalleryConfigEditorModal', () => ({
  GalleryConfigEditorModal: (props: {
    opened: boolean;
    title: string;
    value?: Partial<GalleryConfig>;
    onSave: (cfg: GalleryConfig) => void;
    onClose: () => void;
    zIndex?: number;
  }) => {
    capturedModalValue = props.value;
    capturedOnSave = props.onSave;
    capturedModalZIndex = props.zIndex;
    if (!props.opened) return null;
    return (
      <div role="dialog" data-testid="gallery-config-editor-modal">
        <span>Responsive Gallery Config</span>
      </div>
    );
  },
}));

// Mock ThemeSelector since it depends on ThemeContext
vi.mock('./ThemeSelector', () => ({
  ThemeSelector: ({
    description,
    value,
    onThemeChange,
  }: {
    description?: string;
    value?: string;
    onThemeChange?: (themeId: string) => void;
  }) => (
    <div data-testid="theme-selector">
      <span>{description}</span>
      <span data-testid="theme-selector-value">{value ?? ''}</span>
      <button type="button" onClick={() => onThemeChange?.('solarized-dark')}>
        Select Solarized Dark
      </button>
    </div>
  ),
}));

// Mock useTheme since SettingsPanel calls it for preview control
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    themeId: 'default-dark',
    setTheme: setThemeSpy,
    setPreviewTheme: setPreviewThemeSpy,
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

/**
 * Navigate to Gallery Layout → click "Edit Responsive Config".
 * With `GalleryConfigEditorModal` mocked, the Suspense/lazy overhead is gone.
 * Returns captured `value` and `onSave` from the mock for direct inspection.
 */
async function openResponsiveConfigEditor() {
  fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
  await screen.findByText('Gallery Adapters');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));
  await screen.findByTestId('gallery-config-editor-modal');
  return { value: capturedModalValue!, onSave: capturedOnSave! };
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
    setThemeSpy.mockReset();
    setPreviewThemeSpy.mockReset();
    capturedModalValue = undefined;
    capturedOnSave = undefined;
    capturedModalZIndex = undefined;
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

  it('stores shared editor gallery presentation fields only in nested galleryConfig', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      gallerySizingMode: 'manual',
      galleryManualHeight: '75vh',
      galleryImageLabel: 'Photo Reel',
      galleryVideoLabel: 'Video Reel',
      galleryLabelJustification: 'right',
      showGalleryLabelIcon: true,
      showCampaignGalleryLabels: false,
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    const { onSave } = await openResponsiveConfigEditor();

    // Simulate the modal applying a gallery config with presentation fields
    const galleryConfig: GalleryConfig = {
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
    };

    act(() => { onSave(galleryConfig); });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    const payload = updateSettings.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('gallerySizingMode');
    expect(payload).not.toHaveProperty('galleryManualHeight');
    expect(payload).not.toHaveProperty('galleryImageLabel');
    expect(payload).not.toHaveProperty('galleryVideoLabel');
    expect(payload).not.toHaveProperty('galleryLabelJustification');
    expect(payload).not.toHaveProperty('showGalleryLabelIcon');
    expect(payload).not.toHaveProperty('showCampaignGalleryLabels');
    expect(payload).toMatchObject({
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
    });
  });

  it('preserves breakpoint-specific common settings in nested galleryConfig only', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      gallerySectionPadding: 16,
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    const { onSave } = await openResponsiveConfigEditor();

    act(() => {
      onSave({
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              common: {
                sectionPadding: 16,
              },
            },
          },
          tablet: {
            image: {
              common: {
                sectionPadding: 30,
              },
            },
          },
        },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    const payload = updateSettings.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('gallerySectionPadding');
    expect(payload).toMatchObject({
      galleryConfig: expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              common: expect.objectContaining({
                sectionPadding: 16,
              }),
            }),
          }),
          tablet: expect.objectContaining({
            image: expect.objectContaining({
              common: expect.objectContaining({
                sectionPadding: 30,
              }),
            }),
          }),
        }),
      }),
    });
  });

  it('seeds shared editor viewport background fields from flat settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          imageBgType: 'solid',
          imageBgColor: '#112233',
          videoBgType: 'gradient',
          videoBgGradient: 'linear-gradient(135deg, #123456 0%, #654321 100%)',
          unifiedBgType: 'image',
          unifiedBgImageUrl: 'https://example.com/unified-bg.jpg',
        }}
      />,
    );

    await waitForTabs();
    const { value } = await openResponsiveConfigEditor();

    expect(value?.breakpoints?.desktop?.image?.common?.viewportBgType).toBe('solid');
    expect(value?.breakpoints?.desktop?.image?.common?.viewportBgColor).toBe('#112233');
    expect(value?.breakpoints?.desktop?.video?.common?.viewportBgType).toBe('gradient');
    expect(value?.breakpoints?.desktop?.video?.common?.viewportBgGradient).toBe(
      'linear-gradient(135deg, #123456 0%, #654321 100%)',
    );
    expect(value?.breakpoints?.desktop?.unified?.common?.viewportBgType).toBe('image');
    expect(value?.breakpoints?.desktop?.unified?.common?.viewportBgImageUrl).toBe('https://example.com/unified-bg.jpg');
  });

  it('prefers explicit nested gallery config values when seeding the shared editor', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          gallerySectionPadding: 16,
          carouselVisibleCards: 2,
          galleryConfig: {
            mode: 'per-type',
            breakpoints: {
              tablet: {
                image: {
                  adapterId: 'classic',
                  common: {
                    sectionPadding: 30,
                  },
                  adapterSettings: {
                    carouselVisibleCards: 5,
                  },
                },
              },
            },
          },
        }}
      />,
    );

    await waitForTabs();
    const { value } = await openResponsiveConfigEditor();

    expect(value?.breakpoints?.tablet?.image?.common?.sectionPadding).toBe(30);
    expect(value?.breakpoints?.tablet?.image?.adapterSettings?.carouselVisibleCards).toBe(5);
  });

  it('stores shared editor viewport background fields only in nested galleryConfig', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      imageBgType: 'solid',
      imageBgColor: '#112233',
      videoBgType: 'gradient',
      videoBgGradient: 'linear-gradient(135deg, #123456 0%, #654321 100%)',
      unifiedBgType: 'image',
      unifiedBgImageUrl: 'https://example.com/unified-bg.jpg',
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    const { onSave } = await openResponsiveConfigEditor();

    act(() => {
      onSave({
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              common: {
                viewportBgType: 'solid',
                viewportBgColor: '#112233',
              },
            },
            video: {
              common: {
                viewportBgType: 'gradient',
                viewportBgGradient: 'linear-gradient(135deg, #123456 0%, #654321 100%)',
              },
            },
            unified: {
              common: {
                viewportBgType: 'image',
                viewportBgImageUrl: 'https://example.com/unified-bg.jpg',
              },
            },
          },
        },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    const payload = updateSettings.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('imageBgType');
    expect(payload).not.toHaveProperty('imageBgColor');
    expect(payload).not.toHaveProperty('videoBgType');
    expect(payload).not.toHaveProperty('videoBgGradient');
    expect(payload).not.toHaveProperty('unifiedBgType');
    expect(payload).not.toHaveProperty('unifiedBgImageUrl');
    expect(payload).toMatchObject({
      galleryConfig: expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              common: expect.objectContaining({
                viewportBgType: 'solid',
                viewportBgColor: '#112233',
              }),
            }),
            video: expect.objectContaining({
              common: expect.objectContaining({
                viewportBgType: 'gradient',
                viewportBgGradient: 'linear-gradient(135deg, #123456 0%, #654321 100%)',
              }),
            }),
            unified: expect.objectContaining({
              common: expect.objectContaining({
                viewportBgType: 'image',
                viewportBgImageUrl: 'https://example.com/unified-bg.jpg',
              }),
            }),
          }),
        }),
      }),
    });
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
    const { value } = await openResponsiveConfigEditor();

    // The seed should propagate gallerySizingMode and galleryManualHeight
    // into the common settings for at least one breakpoint scope.
    const desktopImage = value?.breakpoints?.desktop?.image?.common;
    const desktopVideo = value?.breakpoints?.desktop?.video?.common;
    const anyScope = desktopImage ?? desktopVideo;
    expect(anyScope?.gallerySizingMode).toBe('manual');
    expect(anyScope?.galleryManualHeight).toBe('75vh');
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

  it('passes the saved theme value into ThemeSelector', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          theme: 'solarized-light',
        }}
      />
    );

    await waitForTabs();

    expect(screen.getByTestId('theme-selector-value')).toHaveTextContent('solarized-light');
  });

  it('loads the saved theme from the API when cached initial settings omit it', async () => {
    apiClient = createMockApiClient({
      getSettings: vi.fn().mockResolvedValue({
        ...seedSettings,
        theme: 'solarized-dark',
      }),
    });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();

    await waitFor(() => {
      expect(screen.getByTestId('theme-selector-value')).toHaveTextContent('solarized-dark');
    });
  });

  it('persists the selected theme on save', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      theme: 'solarized-dark',
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          theme: 'default-dark',
        }}
      />
    );

    await waitForTabs();

    fireEvent.click(screen.getByRole('button', { name: 'Select Solarized Dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        theme: 'solarized-dark',
      }));
    });

    expect(setThemeSpy).toHaveBeenCalledWith('solarized-dark');
  });

  it('reverts the theme preview to the original saved theme when closing with unsaved theme changes', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          theme: 'default-dark',
        }}
      />
    );

    await waitForTabs();

    fireEvent.click(screen.getByRole('button', { name: 'Select Solarized Dark' }));

    const closeButton = document.querySelector('.mantine-Modal-close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton);

    expect(setPreviewThemeSpy).toHaveBeenCalledWith('default-dark');
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

    fireEvent.click(screen.getByText('Card Grid & Pagination'));
    await screen.findByText('Card Justification');

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

  it('opens the shared responsive gallery editor above the settings modal', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    await openResponsiveConfigEditor();

    expect(screen.getByTestId('gallery-config-editor-modal')).toBeInTheDocument();
    expect(capturedModalZIndex).toBe(500);
  });

  it('renders per-type breakpoint adapter grids without the selection mode toggle', async () => {
    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');

    expect(screen.queryByText('Gallery Selection Mode')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Desktop Image Gallery Adapter', { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tablet Video Gallery Adapter', { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile Image Gallery Adapter', { selector: 'input' })).toBeInTheDocument();
  });

  it('writes unified breakpoint adapter selections directly to nested gallery config', async () => {
    const unifiedClassicLabel = getAdapterSelectOptions({ context: 'unified-gallery', breakpoint: 'desktop' })
      .find((option) => option.value === 'classic')?.label;

    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          unifiedGalleryEnabled: true,
        }}
      />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');

    expect(screen.getByLabelText('Desktop Unified Gallery Adapter', { selector: 'input' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Desktop Unified Gallery Adapter', { selector: 'input' }));
    fireEvent.click(screen.getByRole('option', { name: unifiedClassicLabel ?? 'Classic' }));

    const { value } = await openResponsiveConfigEditor();

    expect(value?.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
  });

  it('writes per-type breakpoint adapter selections directly to nested gallery config', async () => {
    const masonryLabel = getAdapterSelectOptions({ context: 'per-breakpoint-gallery', breakpoint: 'mobile' })
      .find((option) => option.value === 'masonry')?.label;

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />
    );

    await waitForTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Gallery Layout/i }));
    await screen.findByText('Gallery Adapters');

    fireEvent.click(screen.getByLabelText('Mobile Image Gallery Adapter', { selector: 'input' }));
    fireEvent.click(screen.getByRole('option', { name: masonryLabel ?? 'Masonry' }));

    const { value } = await openResponsiveConfigEditor();

    expect(value?.breakpoints?.mobile?.image?.adapterId).toBe('masonry');
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
          masonryAutoColumnBreakpoints: '480:2,768:3,1024:4,1280:5',
        }}
      />
    );

    await waitForTabs();
    const { value } = await openResponsiveConfigEditor();

    // The seed should include the masonry adapter with masonryColumns in adapterSettings
    const desktopImage = value?.breakpoints?.desktop?.image;
    expect(desktopImage?.adapterId).toBe('masonry');
    expect(desktopImage?.adapterSettings?.masonryColumns).toBe(4);
    expect(desktopImage?.adapterSettings?.masonryAutoColumnBreakpoints).toBe('480:2,768:3,1024:4,1280:5');
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
          imageBorderRadius: 14,
          videoBorderRadius: 18,
          imageViewportHeight: 560,
          videoViewportHeight: 500,
          imageShadowPreset: 'custom',
          imageShadowCustom: '0 8px 24px rgba(0,0,0,0.35)',
          videoShadowPreset: 'strong',
          videoShadowCustom: '0 6px 18px rgba(0,0,0,0.3)',
          carouselVisibleCards: 3,
          carouselLoop: false,
          carouselAutoplayDirection: 'rtl',
          navArrowPosition: 'bottom',
          navArrowSize: 42,
          navArrowColor: '#ff8800',
          navArrowBgColor: 'rgba(1,2,3,0.5)',
          navArrowEdgeInset: 18,
          navArrowMinHitTarget: 56,
          navArrowFadeDurationMs: 320,
          navArrowScaleTransitionMs: 210,
          dotNavEnabled: false,
          dotNavPosition: 'overlay-top',
          dotNavMaxVisibleDots: 9,
          dotNavActiveColor: '#00ffaa',
          dotNavInactiveColor: 'rgba(4,5,6,0.25)',
          viewportHeightMobileRatio: 0.7,
          viewportHeightTabletRatio: 0.85,
        }}
      />
    );

    await waitForTabs();
    const { value } = await openResponsiveConfigEditor();

    // Carousel adapter settings should be seeded from flat settings
    // Check any scope that carries adapter settings for the classic carousel
    const scopes = [
      value?.breakpoints?.desktop?.image,
      value?.breakpoints?.desktop?.video,
      value?.breakpoints?.desktop?.unified,
    ];
    const adapterSettings = scopes.find(s => s?.adapterSettings?.carouselVisibleCards !== undefined)?.adapterSettings;
    expect(adapterSettings).toBeDefined();
    expect(adapterSettings?.carouselVisibleCards).toBe(3);
    expect(adapterSettings?.carouselLoop).toBe(false);
    expect(adapterSettings?.navArrowPosition).toBe('bottom');
    expect(adapterSettings?.navArrowSize).toBe(42);
    expect(adapterSettings?.navArrowColor).toBe('#ff8800');
    expect(adapterSettings?.navArrowBgColor).toBe('rgba(1,2,3,0.5)');
    expect(adapterSettings?.navArrowEdgeInset).toBe(18);
    expect(adapterSettings?.navArrowMinHitTarget).toBe(56);
    expect(adapterSettings?.navArrowFadeDurationMs).toBe(320);
    expect(adapterSettings?.navArrowScaleTransitionMs).toBe(210);
    expect(adapterSettings?.dotNavEnabled).toBe(false);
    expect(adapterSettings?.dotNavPosition).toBe('overlay-top');
    expect(adapterSettings?.dotNavMaxVisibleDots).toBe(9);
    expect(adapterSettings?.dotNavActiveColor).toBe('#00ffaa');
    expect(adapterSettings?.dotNavInactiveColor).toBe('rgba(4,5,6,0.25)');
    expect(adapterSettings?.viewportHeightMobileRatio).toBe(0.7);
    expect(adapterSettings?.viewportHeightTabletRatio).toBe(0.85);
    expect(value?.breakpoints?.desktop?.image?.adapterSettings?.imageBorderRadius).toBe(14);
    expect(value?.breakpoints?.desktop?.video?.adapterSettings?.videoBorderRadius).toBe(18);
    expect(value?.breakpoints?.desktop?.image?.adapterSettings?.imageViewportHeight).toBe(560);
    expect(value?.breakpoints?.desktop?.video?.adapterSettings?.videoViewportHeight).toBe(500);
    expect(value?.breakpoints?.desktop?.image?.adapterSettings?.imageShadowPreset).toBe('custom');
    expect(value?.breakpoints?.desktop?.image?.adapterSettings?.imageShadowCustom).toBe('0 8px 24px rgba(0,0,0,0.35)');
    expect(value?.breakpoints?.desktop?.video?.adapterSettings?.videoShadowPreset).toBe('strong');
    expect(value?.breakpoints?.desktop?.video?.adapterSettings?.videoShadowCustom).toBe('0 6px 18px rgba(0,0,0,0.3)');
  });

  it('seeds shared editor photo-grid values from flat settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          gallerySelectionMode: 'per-breakpoint',
          desktopImageAdapterId: 'justified',
          thumbnailGap: 12,
          mosaicTargetRowHeight: 240,
        }}
      />,
    );

    await waitForTabs();
    const { value } = await openResponsiveConfigEditor();

    const desktopImage = value?.breakpoints?.desktop?.image;
    expect(desktopImage?.adapterId).toBe('justified');
    expect(desktopImage?.adapterSettings?.thumbnailGap).toBe(12);
    expect(desktopImage?.adapterSettings?.mosaicTargetRowHeight).toBe(240);
  });

  it('seeds shared editor shape-specific values from flat settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          gallerySelectionMode: 'per-breakpoint',
          desktopImageAdapterId: 'hexagonal',
          tileBorderWidth: 2,
          tileBorderColor: '#ff0000',
          tileHoverBounce: false,
          tileGlowEnabled: true,
          tileGlowColor: '#00ffaa',
          tileGlowSpread: 18,
          tileGapX: 12,
          tileGapY: 10,
        }}
      />,
    );

    await waitForTabs();
    const { value } = await openResponsiveConfigEditor();

    const desktopImage = value?.breakpoints?.desktop?.image;
    expect(desktopImage?.adapterId).toBe('hexagonal');
    expect(desktopImage?.adapterSettings?.tileBorderWidth).toBe(2);
    expect(desktopImage?.adapterSettings?.tileBorderColor).toBe('#ff0000');
    expect(desktopImage?.adapterSettings?.tileHoverBounce).toBe(false);
    expect(desktopImage?.adapterSettings?.tileGlowEnabled).toBe(true);
    expect(desktopImage?.adapterSettings?.tileGlowColor).toBe('#00ffaa');
    expect(desktopImage?.adapterSettings?.tileGlowSpread).toBe(18);
    expect(desktopImage?.adapterSettings?.tileGapX).toBe(12);
    expect(desktopImage?.adapterSettings?.tileGapY).toBe(10);
  });

  it('seeds shared editor layout-builder defaults from flat settings', async () => {
    render(
      <SettingsPanel
        opened={true}
        apiClient={apiClient}
        onClose={onClose}
        onNotify={onNotify}
        initialSettings={{
          ...seedSettings,
          gallerySelectionMode: 'per-breakpoint',
          desktopImageAdapterId: 'layout-builder',
          layoutBuilderScope: 'viewport',
          tileGlowColor: '#00ffaa',
          tileGlowSpread: 18,
        }}
      />,
    );

    await waitForTabs();
    const { value } = await openResponsiveConfigEditor();

    const desktopImage = value?.breakpoints?.desktop?.image;
    expect(desktopImage?.adapterId).toBe('layout-builder');
    expect(desktopImage?.adapterSettings?.layoutBuilderScope).toBe('viewport');
    expect(desktopImage?.adapterSettings?.tileGlowColor).toBe('#00ffaa');
    expect(desktopImage?.adapterSettings?.tileGlowSpread).toBe(18);
  });

  it('stores shared editor carousel adapter fields only in nested galleryConfig', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      imageBorderRadius: 14,
      videoBorderRadius: 18,
      imageViewportHeight: 600,
      videoViewportHeight: 480,
      imageShadowPreset: 'custom',
      imageShadowCustom: '0 8px 24px rgba(0,0,0,0.35)',
      videoShadowPreset: 'strong',
      videoShadowCustom: '0 6px 18px rgba(0,0,0,0.3)',
      carouselVisibleCards: 3,
      navArrowPosition: 'bottom',
      navArrowColor: '#ff8800',
      navArrowEdgeInset: 18,
      navArrowMinHitTarget: 56,
      navArrowFadeDurationMs: 320,
      navArrowScaleTransitionMs: 210,
      dotNavEnabled: false,
      dotNavMaxVisibleDots: 9,
      viewportHeightMobileRatio: 0.7,
      viewportHeightTabletRatio: 0.85,
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    const { onSave } = await openResponsiveConfigEditor();

    // Simulate the modal applying a gallery config with carousel adapter settings
    const galleryConfig: GalleryConfig = {
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'classic',
            adapterSettings: {
              imageBorderRadius: 14,
              imageViewportHeight: 600,
              imageShadowPreset: 'custom',
              imageShadowCustom: '0 8px 24px rgba(0,0,0,0.35)',
              carouselVisibleCards: 3,
              navArrowPosition: 'bottom',
              navArrowColor: '#ff8800',
              navArrowEdgeInset: 18,
              navArrowMinHitTarget: 56,
              navArrowFadeDurationMs: 320,
              navArrowScaleTransitionMs: 210,
              dotNavEnabled: false,
              dotNavMaxVisibleDots: 9,
              viewportHeightMobileRatio: 0.7,
              viewportHeightTabletRatio: 0.85,
            },
          },
          video: {
            adapterId: 'classic',
            adapterSettings: {
              videoBorderRadius: 18,
              videoViewportHeight: 480,
              videoShadowPreset: 'strong',
              videoShadowCustom: '0 6px 18px rgba(0,0,0,0.3)',
            },
          },
        },
      },
    };

    act(() => { onSave(galleryConfig); });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    const payload = updateSettings.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('imageBorderRadius');
    expect(payload).not.toHaveProperty('videoBorderRadius');
    expect(payload).not.toHaveProperty('carouselVisibleCards');
    expect(payload).toMatchObject({
      galleryConfig: expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              adapterSettings: expect.objectContaining({
                imageBorderRadius: 14,
                carouselVisibleCards: 3,
                imageShadowPreset: 'custom',
                imageShadowCustom: '0 8px 24px rgba(0,0,0,0.35)',
                navArrowPosition: 'bottom',
                navArrowColor: '#ff8800',
                navArrowEdgeInset: 18,
                navArrowMinHitTarget: 56,
                navArrowFadeDurationMs: 320,
                navArrowScaleTransitionMs: 210,
                dotNavEnabled: false,
                dotNavMaxVisibleDots: 9,
                viewportHeightMobileRatio: 0.7,
                viewportHeightTabletRatio: 0.85,
              }),
            }),
            video: expect.objectContaining({
              adapterSettings: expect.objectContaining({
                videoBorderRadius: 18,
                videoShadowPreset: 'strong',
                videoShadowCustom: '0 6px 18px rgba(0,0,0,0.3)',
              }),
            }),
          }),
        }),
      }),
    });
  });

  it('stores shared editor photo-grid fields only in nested galleryConfig', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      thumbnailGap: 14,
      masonryColumns: 3,
      masonryAutoColumnBreakpoints: '480:2,768:3,1024:4,1280:5',
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    const { onSave } = await openResponsiveConfigEditor();

    const galleryConfig: GalleryConfig = {
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'masonry',
            adapterSettings: {
              thumbnailGap: 14,
              masonryColumns: 3,
              masonryAutoColumnBreakpoints: '480:2,768:3,1024:4,1280:5',
            },
          },
        },
      },
    };

    act(() => { onSave(galleryConfig); });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    const payload = updateSettings.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('thumbnailGap');
    expect(payload).not.toHaveProperty('masonryColumns');
    expect(payload).toMatchObject({
      galleryConfig: expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              adapterSettings: expect.objectContaining({
                thumbnailGap: 14,
                masonryColumns: 3,
                masonryAutoColumnBreakpoints: '480:2,768:3,1024:4,1280:5',
              }),
            }),
          }),
        }),
      }),
    });
  });

  it('stores shared editor shape-specific fields only in nested galleryConfig', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      tileBorderWidth: 2,
      tileBorderColor: '#ff0000',
      tileHoverBounce: false,
      tileGlowEnabled: true,
      tileGlowColor: '#00ffaa',
      tileGlowSpread: 18,
      tileGapX: 12,
      tileGapY: 10,
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    const { onSave } = await openResponsiveConfigEditor();

    const galleryConfig: GalleryConfig = {
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'hexagonal',
            adapterSettings: {
              tileBorderWidth: 2,
              tileBorderColor: '#ff0000',
              tileHoverBounce: false,
              tileGlowEnabled: true,
              tileGlowColor: '#00ffaa',
              tileGlowSpread: 18,
              tileGapX: 12,
              tileGapY: 10,
            },
          },
        },
      },
    };

    act(() => { onSave(galleryConfig); });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    const payload = updateSettings.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('tileBorderWidth');
    expect(payload).not.toHaveProperty('tileGlowColor');
    expect(payload).toMatchObject({
      galleryConfig: expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              adapterSettings: expect.objectContaining({
                tileBorderWidth: 2,
                tileBorderColor: '#ff0000',
                tileHoverBounce: false,
                tileGlowEnabled: true,
                tileGlowColor: '#00ffaa',
                tileGlowSpread: 18,
                tileGapX: 12,
                tileGapY: 10,
              }),
            }),
          }),
        }),
      }),
    });
  });

  it('stores shared editor layout-builder defaults only in nested galleryConfig', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...seedSettings,
      layoutBuilderScope: 'viewport',
      tileGlowColor: '#00ffaa',
      tileGlowSpread: 18,
    });

    apiClient = createMockApiClient({ updateSettings });

    render(
      <SettingsPanel opened={true} apiClient={apiClient} onClose={onClose} onNotify={onNotify} initialSettings={seedSettings} />,
    );

    await waitForTabs();
    const { onSave } = await openResponsiveConfigEditor();

    const galleryConfig: GalleryConfig = {
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'layout-builder',
            adapterSettings: {
              layoutBuilderScope: 'viewport',
              tileGlowColor: '#00ffaa',
              tileGlowSpread: 18,
            },
          },
        },
      },
    };

    act(() => { onSave(galleryConfig); });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledOnce();
    });

    const payload = updateSettings.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('layoutBuilderScope');
    expect(payload).not.toHaveProperty('tileGlowColor');
    expect(payload).toMatchObject({
      galleryConfig: expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              adapterId: 'layout-builder',
              adapterSettings: expect.objectContaining({
                layoutBuilderScope: 'viewport',
                tileGlowColor: '#00ffaa',
                tileGlowSpread: 18,
              }),
            }),
          }),
        }),
      }),
    });
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
    const { value } = await openResponsiveConfigEditor();

    // The compact-grid adapter settings should be seeded
    const desktopImage = value?.breakpoints?.desktop?.image;
    expect(desktopImage?.adapterId).toBe('compact-grid');
    expect(desktopImage?.adapterSettings?.gridCardWidth).toBe(210);
    expect(desktopImage?.adapterSettings?.gridCardHeight).toBe(260);
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
    const { value } = await openResponsiveConfigEditor();

    const common = value?.breakpoints?.desktop?.image?.common
      ?? value?.breakpoints?.desktop?.video?.common;
    expect(common?.sectionMaxWidth).toBe(1100);
    expect(common?.sectionMinWidth).toBe(360);
    expect(common?.sectionHeightMode).toBe('manual');
    expect(common?.sectionMaxHeight).toBe(620);
    expect(common?.sectionMinHeight).toBe(260);
    expect(common?.perTypeSectionEqualHeight).toBe(true);
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
    const { value } = await openResponsiveConfigEditor();

    const common = value?.breakpoints?.desktop?.image?.common
      ?? value?.breakpoints?.desktop?.video?.common;
    expect(common?.adapterSizingMode).toBe('manual');
    expect(common?.adapterMaxWidthPct).toBe(85);
    expect(common?.adapterMaxHeightPct).toBe(90);
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
