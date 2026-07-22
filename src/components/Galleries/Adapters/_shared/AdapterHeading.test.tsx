/**
 * Phase 70-A: unit tests for the shared adapter heading.
 *
 * Covers the three behaviours the per-adapter JSX previously encoded inline:
 * hidden heading → nothing; icon variant (Group + icon, icon gated by
 * `showGalleryLabelIcon`); and the icon-less label-only variant.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import { AdapterHeading } from './AdapterHeading';
import type { ResolvedGalleryHeading, SharedGalleryCommonSettings } from './runtimeCommon';

const heading: ResolvedGalleryHeading = { visible: true, label: 'Images (3)', kind: 'image' };

function common(overrides: Partial<SharedGalleryCommonSettings> = {}): SharedGalleryCommonSettings {
  return { galleryLabelJustification: 'left', showGalleryLabelIcon: true, ...overrides } as SharedGalleryCommonSettings;
}

const ICON = <span data-testid="label-icon" />;

describe('AdapterHeading', () => {
  it('renders nothing when the heading is hidden', () => {
    render(<AdapterHeading common={common()} heading={{ ...heading, visible: false }} icon={ICON} />);
    expect(screen.queryByText('Images (3)')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('label-icon')).not.toBeInTheDocument();
  });

  it('renders the label in the icon variant with the icon shown', () => {
    render(<AdapterHeading common={common({ showGalleryLabelIcon: true })} heading={heading} icon={ICON} />);
    expect(screen.getByText('Images (3)')).toBeInTheDocument();
    expect(screen.getByTestId('label-icon')).toBeInTheDocument();
  });

  it('hides the icon when showGalleryLabelIcon is false but keeps the label', () => {
    render(<AdapterHeading common={common({ showGalleryLabelIcon: false })} heading={heading} icon={ICON} />);
    expect(screen.getByText('Images (3)')).toBeInTheDocument();
    expect(screen.queryByTestId('label-icon')).not.toBeInTheDocument();
  });

  it('renders the bare label with no icon slot in the label-only variant', () => {
    render(<AdapterHeading common={common({ showGalleryLabelIcon: true })} heading={heading} />);
    expect(screen.getByText('Images (3)')).toBeInTheDocument();
    // No icon prop → the icon is never rendered even when the setting is on.
    expect(screen.queryByTestId('label-icon')).not.toBeInTheDocument();
  });

  it('applies the optional titleStyle to the heading element', () => {
    render(
      <AdapterHeading
        common={common()}
        heading={heading}
        icon={ICON}
        titleStyle={{ letterSpacing: '2px' }}
      />,
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveStyle({ letterSpacing: '2px' });
  });
});
