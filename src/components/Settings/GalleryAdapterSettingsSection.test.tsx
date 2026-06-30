import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import { GalleryAdapterSettingsSection } from './GalleryAdapterSettingsSection';

// Default settings use 'classic' adapter which has carousel + media-frame groups.
// carouselVisibleCards (min: 1, max: 10) and imageShadowPreset (select) are reliably rendered.

describe('GalleryAdapterSettingsSection – P56-A validation', () => {
  it('renders without error given valid default settings', () => {
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.getByRole('switch', { name: /unified gallery mode/i })).toBeInTheDocument();
  });

  it('shows a range error when a number field value is above max', () => {
    const settings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, carouselVisibleCards: 15 };
    render(
      <GalleryAdapterSettingsSection
        settings={settings}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.getByText(/enter a value between 1 and 10/i)).toBeInTheDocument();
  });

  it('shows a range error when a number field value is below min', () => {
    const settings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, navArrowSize: -5 };
    render(
      <GalleryAdapterSettingsSection
        settings={settings}
        updateSetting={vi.fn()}
      />,
    );
    // navArrowSize: min 20, max 64
    expect(screen.getByText(/enter a value between 20 and 64/i)).toBeInTheDocument();
  });

  it('shows no range error when a number field value is within bounds', () => {
    const settings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, carouselVisibleCards: 3 };
    render(
      <GalleryAdapterSettingsSection
        settings={settings}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.queryByText(/enter a value between/i)).not.toBeInTheDocument();
  });

  it('shows an enum error when a select field has an invalid stored value', () => {
    const settings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, navArrowPosition: 'far-left' as typeof DEFAULT_GALLERY_BEHAVIOR_SETTINGS['navArrowPosition'] };
    render(
      <GalleryAdapterSettingsSection
        settings={settings}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.getByText(/is not a valid option/i)).toBeInTheDocument();
  });

  it('shows no enum error for a valid select field value', () => {
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.queryByText(/is not a valid option/i)).not.toBeInTheDocument();
  });
});

describe('GalleryAdapterSettingsSection – P56-F hints', () => {
  it('shows range hint on number fields', () => {
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={vi.fn()}
      />,
    );
    // carouselVisibleCards: 1–10, default 1
    expect(screen.getByText(/1–10, default: 1/i)).toBeInTheDocument();
  });
});

describe('GalleryAdapterSettingsSection – P56-F reset', () => {
  it('renders per-field reset buttons for number fields', () => {
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={vi.fn()}
      />,
    );
    // navArrowSize is a number field in the carousel group
    const resetButtons = screen.getAllByRole('button', { name: /reset .* to default/i });
    expect(resetButtons.length).toBeGreaterThan(0);
  });

  it('calls updateSetting with the fallback when a per-field reset is clicked', () => {
    const updateSetting = vi.fn();
    render(
      <GalleryAdapterSettingsSection
        settings={{ ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, carouselVisibleCards: 5 }}
        updateSetting={updateSetting}
      />,
    );
    const resetButton = screen.getByRole('button', { name: /reset visible cards to default/i });
    fireEvent.click(resetButton);
    // updateSetting is called with 'galleryConfig' and a new config (via updateConfiguredAdapterSetting)
    expect(updateSetting).toHaveBeenCalledWith('galleryConfig', expect.anything());
  });

  it('renders the "reset all adapter settings to defaults" button when groups are active', () => {
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /reset all adapter settings to defaults/i })).toBeInTheDocument();
  });

  it('calls updateSetting with galleryConfig when reset-all is clicked', () => {
    const updateSetting = vi.fn();
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={updateSetting}
      />,
    );
    const resetAll = screen.getByRole('button', { name: /reset all adapter settings to defaults/i });
    fireEvent.click(resetAll);
    expect(updateSetting).toHaveBeenCalledWith('galleryConfig', expect.anything());
  });
});

describe('GalleryAdapterSettingsSection – P56-B breakpoint thresholds', () => {
  it('renders the breakpoint threshold section', () => {
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.getByText('Breakpoint Pixel Thresholds')).toBeInTheDocument();
    // The field labels are ReactNode (via fieldLabel helper); verify by label text
    expect(screen.getByText(/mobile max \(px\)/i)).toBeInTheDocument();
    expect(screen.getByText(/tablet max \(px\)/i)).toBeInTheDocument();
  });

  it('shows a range error when mobileBreakpointPx is out of bounds', () => {
    const settings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, mobileBreakpointPx: 100 };
    render(
      <GalleryAdapterSettingsSection
        settings={settings}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.getByText(/enter a value between 320 and 1440/i)).toBeInTheDocument();
  });

  it('shows an ordering error when mobileBreakpointPx >= tabletBreakpointPx', () => {
    const settings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, mobileBreakpointPx: 1200, tabletBreakpointPx: 900 };
    render(
      <GalleryAdapterSettingsSection
        settings={settings}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.getByText(/mobile threshold must be less than tablet threshold/i)).toBeInTheDocument();
  });

  it('calls updateSetting when reset button is clicked', () => {
    const updateSetting = vi.fn();
    render(
      <GalleryAdapterSettingsSection
        settings={{ ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, mobileBreakpointPx: 600 }}
        updateSetting={updateSetting}
      />,
    );
    const resetBtn = screen.getByRole('button', { name: /reset mobile max/i });
    fireEvent.click(resetBtn);
    expect(updateSetting).toHaveBeenCalledWith('mobileBreakpointPx', 768);
  });
});

describe('GalleryAdapterSettingsSection – P56-E capability badges', () => {
  it('renders adapter picker selects in the per-type section', () => {
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={vi.fn()}
      />,
    );
    // Per-type breakpoint section shows image + video adapter selects for each breakpoint
    expect(screen.getByRole('combobox', { name: /desktop image gallery adapter/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /desktop video gallery adapter/i })).toBeInTheDocument();
  });
});

describe('GalleryAdapterSettingsSection – mobile adapter availability (P58-B fix-up)', () => {
  it('no longer shows the mobile-restriction note now that all adapters support mobile', () => {
    render(
      <GalleryAdapterSettingsSection
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        updateSetting={vi.fn()}
      />,
    );
    // Layout Builder used to declare supportsMobile: false; that restriction was
    // removed in the P58-B fix-up, so no adapter options are disabled on mobile
    // and the explanation note no longer renders.
    expect(screen.queryByText(/some adapters are unavailable on mobile/i)).not.toBeInTheDocument();
  });
});
