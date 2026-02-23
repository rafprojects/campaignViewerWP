/**
 * Sprint 4 Tests: P15-E (LayoutBuilderGallery adapter) + P15-F (Template Library)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

// ─── useLayoutTemplate hook tests (unit) ─────────────────────────────────────

describe('useLayoutTemplate', () => {
  const mockTemplate = {
    id: 'tpl-1',
    name: 'Test Layout',
    schemaVersion: 1,
    canvasAspectRatio: 16 / 9,
    canvasMinWidth: 400,
    canvasMaxWidth: 1200,
    backgroundColor: '#000',
    slots: [
      {
        id: 's1',
        x: 0,
        y: 0,
        width: 50,
        height: 100,
        zIndex: 0,
        shape: 'rectangle' as const,
        borderRadius: 4,
        borderWidth: 0,
        borderColor: '#fff',
        objectFit: 'cover' as const,
        objectPosition: '50% 50%',
        clickAction: 'lightbox' as const,
        hoverEffect: 'pop' as const,
      },
    ],
    overlays: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tags: ['test'],
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns null template when templateId is empty', async () => {
    // We import dynamically to test with controlled fetch
    const { useLayoutTemplate } = await import('@/hooks/useLayoutTemplate');
    const { renderHook } = await import('@testing-library/react');

    const { result } = renderHook(() => useLayoutTemplate(''));
    expect(result.current.template).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns null template when templateId is undefined', async () => {
    const { useLayoutTemplate } = await import('@/hooks/useLayoutTemplate');
    const { renderHook } = await import('@testing-library/react');

    const { result } = renderHook(() => useLayoutTemplate(undefined));
    expect(result.current.template).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches template from public endpoint on valid ID', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplate),
    });
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const { useLayoutTemplate } = await import('@/hooks/useLayoutTemplate');
    const { renderHook, waitFor: hookWaitFor } = await import('@testing-library/react');

    const { result } = renderHook(() => useLayoutTemplate('tpl-1'));

    await hookWaitFor(() => {
      expect(result.current.template).not.toBeNull();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/wp-json/wp-super-gallery/v1/layout-templates/tpl-1'),
    );
    expect(result.current.template!.name).toBe('Test Layout');
    expect(result.current.error).toBeNull();
  });

  it('returns error on fetch failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const { useLayoutTemplate } = await import('@/hooks/useLayoutTemplate');
    const { renderHook, waitFor: hookWaitFor } = await import('@testing-library/react');

    const { result } = renderHook(() => useLayoutTemplate('bad-id'));

    await hookWaitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.template).toBeNull();
    expect(result.current.error).toContain('404');
  });
});

// ─── LayoutBuilderGallery adapter tests ──────────────────────────────────────

describe('LayoutBuilderGallery', () => {
  const mockSlot = {
    id: 's1',
    x: 10,
    y: 10,
    width: 30,
    height: 40,
    zIndex: 0,
    shape: 'rectangle' as const,
    borderRadius: 4,
    borderWidth: 0,
    borderColor: '#fff',
    objectFit: 'cover' as const,
    objectPosition: '50% 50%',
    clickAction: 'lightbox' as const,
    hoverEffect: 'pop' as const,
  };

  const mockTemplate = {
    id: 'tpl-1',
    name: 'Two Slot Layout',
    schemaVersion: 1,
    canvasAspectRatio: 16 / 9,
    canvasMinWidth: 400,
    canvasMaxWidth: 1200,
    backgroundColor: '#111',
    slots: [
      mockSlot,
      { ...mockSlot, id: 's2', x: 50, y: 10, width: 40, height: 40 },
    ],
    overlays: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tags: [],
  };

  const mockMedia = [
    { id: 'm1', type: 'image' as const, source: 'upload' as const, url: '/img1.jpg', title: 'Image 1', order: 0 },
    { id: 'm2', type: 'image' as const, source: 'upload' as const, url: '/img2.jpg', title: 'Image 2', order: 1 },
  ];

  const defaultSettings = {
    tileHoverBounce: false,
    tileGlowEnabled: false,
    tileGlowColor: '#fff',
    tileGlowSpread: 4,
    imageBorderRadius: 0,
    tileBorderWidth: 0,
    tileBorderColor: '#fff',
  } as unknown as import('@/types').GalleryBehaviorSettings;

  let originalFetch: typeof globalThis.fetch;
  let originalRO: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalRO = globalThis.ResizeObserver;

    // Mock fetch for useLayoutTemplate
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplate),
    }) as unknown as typeof globalThis.fetch;

    // Mock ResizeObserver with contentRect reporting
    globalThis.ResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => ({
      observe: (el: Element) => {
        callback(
          [{ contentRect: { width: 800, height: 450 }, target: el } as unknown as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      },
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    })) as unknown as typeof globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.ResizeObserver = originalRO;
    vi.restoreAllMocks();
  });

  it('renders loading state initially', async () => {
    // Slow down fetch — never resolves
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof globalThis.fetch;

    const { LayoutBuilderGallery } = await import(
      '@/gallery-adapters/layout-builder/LayoutBuilderGallery'
    );

    render(
      <LayoutBuilderGallery
        media={mockMedia}
        settings={defaultSettings}
        templateId="tpl-1"
      />,
    );

    expect(screen.getByLabelText('Loading layout template')).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof globalThis.fetch;

    const { LayoutBuilderGallery } = await import(
      '@/gallery-adapters/layout-builder/LayoutBuilderGallery'
    );

    render(
      <LayoutBuilderGallery
        media={mockMedia}
        settings={defaultSettings}
        templateId="bad-id"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
    });
  });

  it('renders slots with assigned media after template loads', async () => {
    const { LayoutBuilderGallery } = await import(
      '@/gallery-adapters/layout-builder/LayoutBuilderGallery'
    );

    render(
      <LayoutBuilderGallery
        media={mockMedia}
        settings={defaultSettings}
        templateId="tpl-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Layout Gallery (2)')).toBeInTheDocument();
    });

    // Should render accessible buttons for lightbox-enabled slots
    const buttons = screen.getAllByRole('button');
    const lightboxButtons = buttons.filter((b) =>
      b.getAttribute('aria-label')?.includes('lightbox'),
    );
    expect(lightboxButtons.length).toBe(2);
  });

  it('shows mismatch warning when media count differs from slot count', async () => {
    // 3 media for 2 slots
    const extraMedia = [
      ...mockMedia,
      { id: 'm3', type: 'image' as const, source: 'upload' as const, url: '/img3.jpg', title: 'Image 3', order: 2 },
    ];

    const { LayoutBuilderGallery } = await import(
      '@/gallery-adapters/layout-builder/LayoutBuilderGallery'
    );

    render(
      <LayoutBuilderGallery
        media={extraMedia}
        settings={defaultSettings}
        templateId="tpl-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/1 media item\(s\) have no slot/)).toBeInTheDocument();
    });
  });

  it('shows empty slot placeholder when fewer media than slots', async () => {
    // 1 media for 2 slots
    const lessMedia = [mockMedia[0]];

    const { LayoutBuilderGallery } = await import(
      '@/gallery-adapters/layout-builder/LayoutBuilderGallery'
    );

    render(
      <LayoutBuilderGallery
        media={lessMedia}
        settings={defaultSettings}
        templateId="tpl-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Empty')).toBeInTheDocument();
      expect(screen.getByText(/1 slot\(s\) have no media/)).toBeInTheDocument();
    });
  });
});

// ─── CampaignFormModal layoutTemplateId tests ────────────────────────────────

describe('CampaignFormModal layout selector', () => {
  const defaultFormState = {
    title: 'Test',
    description: 'Desc',
    company: 'co',
    status: 'draft' as const,
    visibility: 'private' as const,
    tags: '',
    publishAt: '',
    unpublishAt: '',
    layoutTemplateId: '',
  };

  const mockTemplates = [
    {
      id: 'tpl-1',
      name: 'Hero Layout',
      schemaVersion: 1,
      canvasAspectRatio: 16 / 9,
      canvasMinWidth: 400,
      canvasMaxWidth: 1200,
      backgroundColor: '#000',
      slots: [
        {
          id: 's1',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 0,
          shape: 'rectangle' as const,
          borderRadius: 0,
          borderWidth: 0,
          borderColor: '#fff',
          objectFit: 'cover' as const,
          objectPosition: '50% 50%',
          clickAction: 'lightbox' as const,
          hoverEffect: 'none' as const,
        },
      ],
      overlays: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      tags: [],
    },
  ];

  beforeEach(() => {
    // Mantine's Modal→ScrollArea needs ResizeObserver — ensure it exists
    // (test/setup.ts provides a base mock, but restoreAllMocks can clear vi.stubGlobal calls)
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders layout template selector when templates are provided', async () => {
    const { CampaignFormModal } = await import('@/components/Admin/CampaignFormModal');

    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={{ id: 'c1' }}
        formState={defaultFormState}
        onFormChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        layoutTemplates={mockTemplates}
      />,
    );

    expect(screen.getByText('Layout Template')).toBeInTheDocument();
  });

  it('does not render layout selector when no templates', async () => {
    const { CampaignFormModal } = await import('@/components/Admin/CampaignFormModal');

    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={{ id: 'c1' }}
        formState={defaultFormState}
        onFormChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        layoutTemplates={[]}
      />,
    );

    expect(screen.queryByText('Layout Template')).not.toBeInTheDocument();
  });

  it('shows Edit Layout button when a template is selected', async () => {
    const { CampaignFormModal } = await import('@/components/Admin/CampaignFormModal');
    const onEditLayout = vi.fn();

    render(
      <CampaignFormModal
        opened={true}
        editingCampaign={{ id: 'c1' }}
        formState={{ ...defaultFormState, layoutTemplateId: 'tpl-1' }}
        onFormChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        layoutTemplates={mockTemplates}
        onEditLayout={onEditLayout}
      />,
    );

    const editBtn = screen.getByText('Edit Layout');
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onEditLayout).toHaveBeenCalledWith('tpl-1');
  });
});

// ─── LayoutTemplateList import/export logic tests ────────────────────────────

describe('LayoutTemplateList import validation', () => {
  it('validates template JSON structure', () => {
    // Test the validation logic directly
    const isValidTemplate = (data: unknown): boolean => {
      if (!data || typeof data !== 'object') return false;
      const t = data as Record<string, unknown>;
      return (
        typeof t.name === 'string' &&
        typeof t.canvasAspectRatio === 'number' &&
        Array.isArray(t.slots) &&
        (t.slots as unknown[]).every(
          (s: unknown) =>
            s &&
            typeof s === 'object' &&
            typeof (s as Record<string, unknown>).x === 'number' &&
            typeof (s as Record<string, unknown>).y === 'number' &&
            typeof (s as Record<string, unknown>).width === 'number' &&
            typeof (s as Record<string, unknown>).height === 'number',
        )
      );
    };

    // Valid template
    expect(
      isValidTemplate({
        name: 'Test',
        canvasAspectRatio: 1.78,
        slots: [{ x: 0, y: 0, width: 50, height: 50 }],
      }),
    ).toBe(true);

    // Missing name
    expect(
      isValidTemplate({
        canvasAspectRatio: 1.78,
        slots: [],
      }),
    ).toBe(false);

    // Missing aspect ratio
    expect(
      isValidTemplate({
        name: 'Test',
        slots: [],
      }),
    ).toBe(false);

    // Missing slot dimensions
    expect(
      isValidTemplate({
        name: 'Test',
        canvasAspectRatio: 1.78,
        slots: [{ x: 0, y: 0 }], // missing width/height
      }),
    ).toBe(false);

    // Null
    expect(isValidTemplate(null)).toBe(false);

    // String
    expect(isValidTemplate('not an object')).toBe(false);

    // Empty slots array is valid
    expect(
      isValidTemplate({
        name: 'Empty',
        canvasAspectRatio: 1,
        slots: [],
      }),
    ).toBe(true);
  });
});

// ─── Shape clip-path tests — now using the shared utility ───────────────────

describe('LayoutBuilderGallery shape rendering', () => {
  it('applies correct clip-path for each shape type (via shared util)', async () => {
    const { getClipPath } = await import('@/utils/clipPath');
    const { DEFAULT_LAYOUT_SLOT } = await import('@/types');

    const makeSlot = (shape: import('@/types').LayoutSlot['shape'], clipPath?: string) => ({
      ...DEFAULT_LAYOUT_SLOT,
      id: 'test',
      shape,
      clipPath,
    });

    expect(getClipPath(makeSlot('rectangle'))).toBeUndefined();
    expect(getClipPath(makeSlot('circle'))).toBe('circle(50% at 50% 50%)');
    expect(getClipPath(makeSlot('ellipse'))).toBe('ellipse(50% 50% at 50% 50%)');
    expect(getClipPath(makeSlot('hexagon'))).toContain('polygon');
    expect(getClipPath(makeSlot('diamond'))).toContain('polygon');
    expect(getClipPath(makeSlot('parallelogram-left'))).toContain('polygon');
    expect(getClipPath(makeSlot('parallelogram-right'))).toContain('polygon');
    expect(getClipPath(makeSlot('chevron'))).toContain('polygon');
    expect(getClipPath(makeSlot('arrow'))).toContain('polygon');
    expect(getClipPath(makeSlot('trapezoid'))).toContain('polygon');
    expect(getClipPath(makeSlot('custom', 'polygon(0 0, 100% 0, 100% 100%)'))).toBe(
      'polygon(0 0, 100% 0, 100% 100%)',
    );
    expect(getClipPath(makeSlot('custom'))).toBeUndefined();
  });
});

// ─── Overlay rendering tests ─────────────────────────────────────────────────

describe('LayoutBuilderGallery overlay rendering', () => {
  const overlayTemplate = {
    id: 'tpl-overlay',
    name: 'Overlay Test',
    schemaVersion: 1,
    canvasAspectRatio: 16 / 9,
    canvasMinWidth: 400,
    canvasMaxWidth: 1200,
    backgroundColor: '#000',
    slots: [
      {
        id: 's1',
        x: 10,
        y: 10,
        width: 30,
        height: 40,
        zIndex: 1,
        shape: 'rectangle' as const,
        borderRadius: 4,
        borderWidth: 0,
        borderColor: '#fff',
        objectFit: 'cover' as const,
        objectPosition: '50% 50%',
        clickAction: 'lightbox' as const,
        hoverEffect: 'pop' as const,
      },
    ],
    overlays: [
      {
        id: 'ov1',
        imageUrl: 'https://example.com/overlay.png',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 999,
        opacity: 0.7,
        pointerEvents: false,
      },
    ],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tags: [],
  };

  let originalFetch: typeof globalThis.fetch;
  let originalRO: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalRO = globalThis.ResizeObserver;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(overlayTemplate),
    }) as unknown as typeof globalThis.fetch;

    globalThis.ResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => ({
      observe: (el: Element) => {
        callback(
          [{ contentRect: { width: 800, height: 450 }, target: el } as unknown as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      },
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    })) as unknown as typeof globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.ResizeObserver = originalRO;
    vi.restoreAllMocks();
  });

  it('renders overlay images from template', async () => {
    const mockMedia = [
      { id: 'm1', type: 'image' as const, source: 'upload' as const, url: '/img1.jpg', title: 'Image 1', order: 0 },
    ];

    const defaultSettings = {
      tileHoverBounce: false,
      tileGlowEnabled: false,
      tileGlowColor: '#fff',
      tileGlowSpread: 4,
      imageBorderRadius: 0,
      tileBorderWidth: 0,
      tileBorderColor: '#fff',
    } as unknown as import('@/types').GalleryBehaviorSettings;

    const { LayoutBuilderGallery } = await import(
      '@/gallery-adapters/layout-builder/LayoutBuilderGallery'
    );

    render(
      <LayoutBuilderGallery
        media={mockMedia}
        settings={defaultSettings}
        templateId="tpl-overlay"
      />,
    );

    await waitFor(() => {
      const overlayImg = document.querySelector('img[src="https://example.com/overlay.png"]');
      expect(overlayImg).toBeTruthy();
    });
  });

  it('applies correct opacity to overlay wrapper', async () => {
    const mockMedia = [
      { id: 'm1', type: 'image' as const, source: 'upload' as const, url: '/img1.jpg', title: 'Image 1', order: 0 },
    ];

    const defaultSettings = {
      tileHoverBounce: false,
      tileGlowEnabled: false,
      tileGlowColor: '#fff',
      tileGlowSpread: 4,
      imageBorderRadius: 0,
      tileBorderWidth: 0,
      tileBorderColor: '#fff',
    } as unknown as import('@/types').GalleryBehaviorSettings;

    const { LayoutBuilderGallery } = await import(
      '@/gallery-adapters/layout-builder/LayoutBuilderGallery'
    );

    render(
      <LayoutBuilderGallery
        media={mockMedia}
        settings={defaultSettings}
        templateId="tpl-overlay"
      />,
    );

    await waitFor(() => {
      const overlayImg = document.querySelector('img[src="https://example.com/overlay.png"]') as HTMLElement;
      expect(overlayImg).toBeTruthy();
      // Opacity is on the parent wrapper div, not the img
      const wrapper = overlayImg.parentElement!;
      expect(wrapper.style.opacity).toBe('0.7');
    });
  });

  it('sets pointer-events: none on overlay wrapper with pointerEvents=false', async () => {
    const mockMedia = [
      { id: 'm1', type: 'image' as const, source: 'upload' as const, url: '/img1.jpg', title: 'Image 1', order: 0 },
    ];

    const defaultSettings = {
      tileHoverBounce: false,
      tileGlowEnabled: false,
      tileGlowColor: '#fff',
      tileGlowSpread: 4,
      imageBorderRadius: 0,
      tileBorderWidth: 0,
      tileBorderColor: '#fff',
    } as unknown as import('@/types').GalleryBehaviorSettings;

    const { LayoutBuilderGallery } = await import(
      '@/gallery-adapters/layout-builder/LayoutBuilderGallery'
    );

    render(
      <LayoutBuilderGallery
        media={mockMedia}
        settings={defaultSettings}
        templateId="tpl-overlay"
      />,
    );

    await waitFor(() => {
      const overlayImg = document.querySelector('img[src="https://example.com/overlay.png"]') as HTMLElement;
      expect(overlayImg).toBeTruthy();
      // pointer-events is on the parent wrapper div, not the img
      const wrapper = overlayImg.parentElement!;
      expect(wrapper.style.pointerEvents).toBe('none');
    });
  });
});
