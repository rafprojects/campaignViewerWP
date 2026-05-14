import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { DesignAssetsGrid } from './DesignAssetsGrid';
import type { OverlayLibraryItem } from './BuilderDockContext';

const mockItems: OverlayLibraryItem[] = [
    { id: 'a1', name: 'Circle Mask', url: 'https://example.com/circle.png' },
    { id: 'a2', name: 'Star Mask', url: 'https://example.com/star.png' },
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
});
