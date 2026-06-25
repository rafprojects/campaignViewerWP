import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import { useGalleryAdapterSettingsIO } from './useGalleryAdapterSettingsIO';

// Minimal galleryConfig fixture
const VALID_CONFIG = {
  mode: 'per-type' as const,
  breakpoints: {
    desktop: {
      image: {
        adapterId: 'classic',
        adapterSettings: { carouselVisibleCards: 3 },
      },
    },
  },
};

const WRAPPED_EXPORT = {
  version: '1',
  exportedAt: '2026-06-24T00:00:00.000Z',
  galleryConfig: VALID_CONFIG,
};

/** Build a fake ChangeEvent backed by a file whose text content is `text`. */
function makeFileEvent(text: string): React.ChangeEvent<HTMLInputElement> {
  const file = new File([text], 'settings.json', { type: 'application/json' });
  return {
    target: { files: [file], value: '' },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

/** Invoke handleImport and wait for the jsdom FileReader async completion. */
async function runImport(
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void,
  text: string,
) {
  await act(async () => {
    handleImport(makeFileEvent(text));
    // FileReader.readAsText is async; yield the microtask + timer queues.
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Export ────────────────────────────────────────────────────────────────────

describe('useGalleryAdapterSettingsIO – export', () => {
  it('triggers a download by creating and clicking an <a> element', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') (el as HTMLAnchorElement).click = clickSpy;
      return el;
    });

    const { result } = renderHook(() =>
      useGalleryAdapterSettingsIO({
        galleryConfig: VALID_CONFIG,
        updateSetting: vi.fn(),
      }),
    );

    act(() => result.current.handleExport());

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

// ── Import validation ─────────────────────────────────────────────────────────

describe('useGalleryAdapterSettingsIO – import validation', () => {
  it('applies a valid wrapped export to updateSetting', async () => {
    const updateSetting = vi.fn();
    const { result } = renderHook(() =>
      useGalleryAdapterSettingsIO({
        galleryConfig: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig,
        updateSetting,
      }),
    );

    await runImport(result.current.handleImport, JSON.stringify(WRAPPED_EXPORT));

    expect(updateSetting).toHaveBeenCalledWith(
      'galleryConfig',
      expect.objectContaining({ mode: 'per-type' }),
    );
  });

  it('applies a bare galleryConfig (no wrapper) to updateSetting', async () => {
    const updateSetting = vi.fn();
    const { result } = renderHook(() =>
      useGalleryAdapterSettingsIO({
        galleryConfig: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig,
        updateSetting,
      }),
    );

    await runImport(result.current.handleImport, JSON.stringify(VALID_CONFIG));

    expect(updateSetting).toHaveBeenCalledWith(
      'galleryConfig',
      expect.objectContaining({ mode: 'per-type' }),
    );
  });

  it('rejects an unknown adapter ID without calling updateSetting', async () => {
    const updateSetting = vi.fn();
    const { result } = renderHook(() =>
      useGalleryAdapterSettingsIO({
        galleryConfig: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig,
        updateSetting,
      }),
    );

    const bad = {
      galleryConfig: {
        mode: 'per-type',
        breakpoints: { desktop: { image: { adapterId: 'unknown-adapter-xyz' } } },
      },
    };
    await runImport(result.current.handleImport, JSON.stringify(bad));

    expect(updateSetting).not.toHaveBeenCalled();
  });

  it('rejects foreign adapter setting keys without calling updateSetting', async () => {
    const updateSetting = vi.fn();
    const { result } = renderHook(() =>
      useGalleryAdapterSettingsIO({
        galleryConfig: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig,
        updateSetting,
      }),
    );

    const bad = {
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'classic',
              adapterSettings: { unknownForeignKey: 42 },
            },
          },
        },
      },
    };
    await runImport(result.current.handleImport, JSON.stringify(bad));

    expect(updateSetting).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON without calling updateSetting', async () => {
    const updateSetting = vi.fn();
    const { result } = renderHook(() =>
      useGalleryAdapterSettingsIO({
        galleryConfig: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig,
        updateSetting,
      }),
    );

    await runImport(result.current.handleImport, '{ not valid json !!');

    expect(updateSetting).not.toHaveBeenCalled();
  });
});
