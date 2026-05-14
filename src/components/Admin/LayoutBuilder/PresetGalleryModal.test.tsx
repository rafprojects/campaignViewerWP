import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { PresetGalleryModal } from './PresetGalleryModal';

describe('PresetGalleryModal', () => {
    it('renders the modal title when opened', () => {
        const { container } = render(
            <PresetGalleryModal
                opened={true}
                onClose={vi.fn()}
                onSelect={vi.fn()}
            />,
        );

        const title = screen.getByText('Start from Template');
        expect(container).toContainElement(title);
    });

	it('renders preset cards', () => {
		render(
			<PresetGalleryModal
				opened={true}
				onClose={vi.fn()}
				onSelect={vi.fn()}
			/>,
		);

		// At least one preset name is rendered (e.g. first preset)
		expect(screen.getByText('Hero + Thumbnails')).toBeDefined();
	});

	it('calls onSelect when a preset card is clicked', () => {
		const onSelect = vi.fn();
		render(
			<PresetGalleryModal
				opened={true}
				onClose={vi.fn()}
				onSelect={onSelect}
			/>,
		);

		// Click the preset card via its name text — event bubbles to the Card onClick
		fireEvent.click(screen.getByText('Hero + Thumbnails'));
		expect(onSelect).toHaveBeenCalled();
	});
});
