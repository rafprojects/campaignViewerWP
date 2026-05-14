import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { MaskPropertiesPanel } from './MaskPropertiesPanel';
import type { LayoutSlot } from '@/types';

const mockSlot: LayoutSlot = {
    id: 'slot-1',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    zIndex: 1,
    shape: 'rectangle',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: '#000000',
    objectFit: 'cover',
    objectPosition: '50% 50%',
    clickAction: 'lightbox',
    hoverEffect: 'none',
};

// Slot with a maskLayer so the full controls panel renders instead of the "No mask layer" prompt
const slotWithMask: LayoutSlot = {
	...mockSlot,
	maskLayer: { url: 'https://example.com/mask.png', mode: 'alpha', x: 0, y: 0, width: 100, height: 100, feather: 0 },
};

describe('MaskPropertiesPanel', () => {
	it('renders without crashing for a slot with no mask', () => {
		const { container } = render(
			<MaskPropertiesPanel slot={mockSlot} onUpdate={vi.fn()} />,
		);
		expect(container.firstChild).toBeTruthy();
	});

	it('shows the no-mask prompt when slot has no mask', () => {
		render(<MaskPropertiesPanel slot={mockSlot} onUpdate={vi.fn()} />);
		expect(screen.getByText(/No mask layer on this slot/i)).toBeDefined();
	});

	it('renders full controls when slot has a maskLayer', () => {
		render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={vi.fn()} />);

		// Mode segmented control should appear
		expect(screen.getByText('Luminance')).toBeDefined();
		expect(screen.getByText('Alpha')).toBeDefined();
	});

	it('renders upload/replace button when onUploadMask provided', () => {
		render(
			<MaskPropertiesPanel
				slot={slotWithMask}
				onUpdate={vi.fn()}
				onUploadMask={vi.fn()}
			/>,
		);

		// FileButton renders "Replace" because slotWithMask has a mask image URL
		const btn = screen.getByRole('button', { name: /upload|replace/i });
		expect(btn).toBeDefined();
	});

	it('renders Design Assets library when overlayLibrary provided', () => {
		const library = [
			{ id: 'lib1', name: 'Soft Circle', url: 'https://example.com/soft.png' },
		];

		render(
			<MaskPropertiesPanel
				slot={slotWithMask}
				onUpdate={vi.fn()}
				overlayLibrary={library}
			/>,
		);

		expect(screen.getByAltText('Soft Circle')).toBeDefined();
	});
});
