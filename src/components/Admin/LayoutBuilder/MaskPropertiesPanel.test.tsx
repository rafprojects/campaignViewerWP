import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
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

describe('MaskPropertiesPanel — interactions', () => {
	it('calls onUpdate with new mode when mode segmented control changes', () => {
		const onUpdate = vi.fn();
		render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={onUpdate} />);
		fireEvent.click(screen.getByText('Luminance'));
		expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ maskLayer: expect.objectContaining({ mode: 'luminance' }) }));
	});

	it('calls onUpdate when X position input changes', () => {
		const onUpdate = vi.fn();
		const { container } = render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={onUpdate} />);
		// SegmentedControl renders radio inputs; skip those and target text inputs by order (X=0,Y=1,W=2,H=3)
		const numInputs = container.querySelectorAll('input[type="text"]');
		fireEvent.change(numInputs[0]!, { target: { value: '15' } });
		expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ maskLayer: expect.objectContaining({ x: 15 }) }));
	});

	it('calls onUpdate when Y position input changes', () => {
		const onUpdate = vi.fn();
		const { container } = render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={onUpdate} />);
		const numInputs = container.querySelectorAll('input[type="text"]');
		fireEvent.change(numInputs[1]!, { target: { value: '25' } });
		expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ maskLayer: expect.objectContaining({ y: 25 }) }));
	});

	it('calls onUpdate when W scale input changes', () => {
		const onUpdate = vi.fn();
		const { container } = render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={onUpdate} />);
		const numInputs = container.querySelectorAll('input[type="text"]');
		fireEvent.change(numInputs[2]!, { target: { value: '120' } });
		expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ maskLayer: expect.objectContaining({ width: 120 }) }));
	});

	it('calls onUpdate when H scale input changes', () => {
		const onUpdate = vi.fn();
		const { container } = render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={onUpdate} />);
		const numInputs = container.querySelectorAll('input[type="text"]');
		fireEvent.change(numInputs[3]!, { target: { value: '80' } });
		expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ maskLayer: expect.objectContaining({ height: 80 }) }));
	});

	it('auto-fit button resets position and size to canvas', () => {
		const onUpdate = vi.fn();
		render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={onUpdate} />);
		fireEvent.click(screen.getByRole('button', { name: /auto-fit/i }));
		expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
			maskLayer: expect.objectContaining({ x: 0, y: 0, width: 100, height: 100 }),
		}));
	});

	it('clear image button sets url to empty string', () => {
		const onUpdate = vi.fn();
		render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={onUpdate} />);
		fireEvent.click(screen.getByRole('button', { name: /clear image/i }));
		expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ maskLayer: expect.objectContaining({ url: '' }) }));
	});

	it('remove mask layer button clears maskLayer/maskUrl/maskMode', () => {
		const onUpdate = vi.fn();
		render(<MaskPropertiesPanel slot={slotWithMask} onUpdate={onUpdate} />);
		fireEvent.click(screen.getByRole('button', { name: /remove mask layer/i }));
		expect(onUpdate).toHaveBeenCalledWith({ maskLayer: undefined, maskUrl: undefined, maskMode: undefined });
	});

	it('shows no-mask prompt when slot has neither maskLayer nor maskUrl', () => {
		render(<MaskPropertiesPanel slot={mockSlot} onUpdate={vi.fn()} />);
		expect(screen.getByText(/no mask layer on this slot/i)).toBeInTheDocument();
	});
});
