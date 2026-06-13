import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { DesignAssetsGrid } from './DesignAssetsGrid';
import { getAssetFileType } from '@/utils/assetFileType';
import type { AssetLibraryItem } from './BuilderDockContext';

const mockItems: AssetLibraryItem[] = [
    { id: 'a1', name: 'Circle Mask', url: 'https://example.com/circle.png', isUniversal: false, tags: [], uploadedAt: '2025-01-01' },
    { id: 'a2', name: 'Star Mask', url: 'https://example.com/star.svg', isUniversal: true, tags: ['shape'], uploadedAt: '2025-01-01' },
];

describe('DesignAssetsGrid', () => {
    it('shows empty state when no items', () => {
        const { container } = render(<DesignAssetsGrid items={[]} />);

        const msg = screen.getByText(/No design assets/i);
        expect(container).toContainElement(msg);
    });

    it('renders each item image', () => {
        render(<DesignAssetsGrid items={mockItems} />);

        expect(screen.getByAltText('Circle Mask')).toBeDefined();
        expect(screen.getByAltText('Star Mask')).toBeDefined();
    });

    it('calls onSelect with item url when clicked', () => {
        const onSelect = vi.fn();
        render(<DesignAssetsGrid items={mockItems} onSelect={onSelect} />);

        // Click the img — event bubbles up to the Box div which has onClick
        fireEvent.click(screen.getByAltText('Circle Mask'));
        expect(onSelect).toHaveBeenCalledWith(mockItems[0].url);
    });

    it('renders delete buttons when onDelete provided', () => {
        const onDelete = vi.fn();
        render(<DesignAssetsGrid items={mockItems} onDelete={onDelete} />);

        // Two delete buttons (one per item)
        const deleteBtns = screen.getAllByRole('button', { name: /delete/i });
        expect(deleteBtns).toHaveLength(2);
    });

    it('renders a file-type badge derived from the URL extension', () => {
        render(<DesignAssetsGrid items={mockItems} />);

        expect(screen.getByText('PNG')).toBeDefined();
        expect(screen.getByText('SVG')).toBeDefined();
    });

    it('renders the universal toggle and fires the mutation when clicked', () => {
        const onSetUniversal = vi.fn();
        render(<DesignAssetsGrid items={mockItems} onSetUniversal={onSetUniversal} />);

        // a1 is not universal → clicking should request enabling it.
        fireEvent.click(screen.getByRole('button', { name: /Make Circle Mask available to all spaces/i }));
        expect(onSetUniversal).toHaveBeenCalledWith('a1', true);

        // a2 is universal → clicking should request making it space-specific.
        fireEvent.click(screen.getByRole('button', { name: /Make Star Mask space-specific/i }));
        expect(onSetUniversal).toHaveBeenCalledWith('a2', false);
    });

    it('does not render the universal toggle when onSetUniversal is absent', () => {
        render(<DesignAssetsGrid items={mockItems} />);
        expect(screen.queryByRole('button', { name: /available to all spaces|space-specific/i })).toBeNull();
    });

    it('renders a tag editor per item when onSetTags is provided', () => {
        render(<DesignAssetsGrid items={mockItems} onSetTags={vi.fn()} />);
        expect(screen.getByRole('button', { name: /Edit tags for Circle Mask/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Edit tags for Star Mask/i })).toBeDefined();
    });

    it('does not render the tag editor when onSetTags is absent', () => {
        render(<DesignAssetsGrid items={mockItems} />);
        expect(screen.queryByRole('button', { name: /Edit tags for/i })).toBeNull();
    });
});

describe('getAssetFileType', () => {
    it('maps common extensions to short labels', () => {
        expect(getAssetFileType('https://x.com/a.png')).toBe('PNG');
        expect(getAssetFileType('https://x.com/a.JPEG')).toBe('JPG');
        expect(getAssetFileType('https://x.com/a.svg?v=2')).toBe('SVG');
        expect(getAssetFileType('https://x.com/a.webp#frag')).toBe('WEBP');
    });

    it('falls back gracefully for unknown / missing extensions', () => {
        expect(getAssetFileType('https://x.com/noext')).toBe('IMG');
        expect(getAssetFileType('https://x.com/a.heic')).toBe('HEIC');
    });
});
