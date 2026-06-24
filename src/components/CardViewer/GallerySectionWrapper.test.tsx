import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { GallerySectionWrapper } from './GallerySectionWrapper';
import type { ContainerDimensions, GalleryBehaviorSettings, ResolvedGallerySectionRuntime } from '@/types';

vi.mock('@/components/Galleries/Adapters/_shared/runtimeCommon', () => ({
	resolveGalleryComponentCommonSettings: vi.fn(() => ({
		sectionMaxWidth: 1200,
		sectionMaxWidthUnit: 'px',
		sectionMinWidth: 0,
		sectionMinWidthUnit: 'px',
		sectionMaxHeight: 0,
		sectionMaxHeightUnit: 'px',
		sectionMinHeight: 0,
		sectionMinHeightUnit: 'px',
		sectionHeightMode: 'auto',
		sectionPadding: 0,
		sectionPaddingUnit: 'px',
		adapterContentPadding: 0,
		adapterContentPaddingUnit: 'px',
		adapterSizingMode: 'auto',
		adapterMaxWidthPct: 100,
		adapterMaxHeightPct: 100,
		adapterItemGap: 8,
		adapterItemGapUnit: 'px',
		adapterJustifyContent: 'center',
		gallerySizingMode: 'auto',
		galleryManualHeight: 0,
		perTypeSectionEqualHeight: false,
		galleryImageLabel: '',
		galleryVideoLabel: '',
		galleryLabelJustification: 'center',
	})),
}));

const minimalSettings: GalleryBehaviorSettings = {
	sectionScale: 1,
	gallerySectionContentOffsetXUnit: 'px',
	gallerySectionContentOffsetYUnit: 'px',
} as unknown as GalleryBehaviorSettings;

const minimalRuntime: ResolvedGallerySectionRuntime = {
	breakpoint: 'desktop',
	scope: 'image',
	common: {},
	background: { type: 'none', color: '', gradient: '', imageUrl: '' },
	adapterSettings: {},
} as unknown as ResolvedGallerySectionRuntime;

describe('GallerySectionWrapper', () => {
	it('renders children via render prop', () => {
		render(
			<GallerySectionWrapper
				settings={minimalSettings}
				runtime={minimalRuntime}
				bgType="none"
				bgColor=""
				bgGradient=""
				bgImageUrl=""
			>
				{(_dims: ContainerDimensions) => <div data-testid="child">inner</div>}
			</GallerySectionWrapper>,
		);

		expect(screen.getByTestId('child')).toBeDefined();
	});

	it('passes a containerDimensions object to children', () => {
		let receivedDims: ContainerDimensions | undefined;

		render(
			<GallerySectionWrapper
				settings={minimalSettings}
				runtime={minimalRuntime}
				bgType="none"
				bgColor=""
				bgGradient=""
				bgImageUrl=""
			>
				{(dims: ContainerDimensions) => {
					receivedDims = dims;
					return <div data-testid="child" />;
				}}
			</GallerySectionWrapper>,
		);

		expect(receivedDims).toMatchObject({
			width: expect.any(Number),
			height: expect.any(Number),
		});
	});

	it('renders with solid background type without crashing', () => {
		expect(() =>
			render(
				<GallerySectionWrapper
					settings={minimalSettings}
					runtime={minimalRuntime}
					bgType="solid"
					bgColor="#ff0000"
					bgGradient=""
					bgImageUrl=""
				>
					{() => <div data-testid="solid-child" />}
				</GallerySectionWrapper>,
			),
		).not.toThrow();

		expect(screen.getByTestId('solid-child')).toBeDefined();
	});

	it('renders with gradient background type without crashing', () => {
		expect(() =>
			render(
				<GallerySectionWrapper
					settings={minimalSettings}
					runtime={minimalRuntime}
					bgType="gradient"
					bgColor=""
					bgGradient="linear-gradient(to right, #000, #fff)"
					bgImageUrl=""
				>
					{() => <div data-testid="gradient-child" />}
				</GallerySectionWrapper>,
			),
		).not.toThrow();

		expect(screen.getByTestId('gradient-child')).toBeDefined();
	});

	it('renders with image background type and valid URL', () => {
		expect(() =>
			render(
				<GallerySectionWrapper
					settings={minimalSettings}
					runtime={minimalRuntime}
					bgType="image"
					bgColor=""
					bgGradient=""
					bgImageUrl="https://example.com/bg.jpg"
				>
					{() => <div data-testid="image-child" />}
				</GallerySectionWrapper>,
			),
		).not.toThrow();
		expect(screen.getByTestId('image-child')).toBeDefined();
	});

	it('renders with image background type and empty URL (safeUrl falsy branch)', () => {
		expect(() =>
			render(
				<GallerySectionWrapper
					settings={minimalSettings}
					runtime={minimalRuntime}
					bgType="image"
					bgColor=""
					bgGradient=""
					bgImageUrl=""
				>
					{() => <div data-testid="image-empty-child" />}
				</GallerySectionWrapper>,
			),
		).not.toThrow();
		expect(screen.getByTestId('image-empty-child')).toBeDefined();
	});
});
