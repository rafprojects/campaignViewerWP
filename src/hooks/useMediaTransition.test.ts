import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useMediaTransition } from './useMediaTransition';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';

vi.mock('@/utils/galleryAnimations', () => ({
	applyGalleryTransition: vi.fn(),
}));

const defaultSettings: GalleryBehaviorSettings = {
	scrollAnimationStyle: 'smooth',
	scrollAnimationDurationMs: 300,
	scrollTransitionType: 'slide-fade',
	scrollAnimationEasing: 'ease',
	transitionFadeEnabled: true,
} as unknown as GalleryBehaviorSettings;

const mockItems: MediaItem[] = [
	{ id: '1', type: 'image', source: 'upload', url: 'https://example.com/1.jpg', order: 0 },
	{ id: '2', type: 'image', source: 'upload', url: 'https://example.com/2.jpg', order: 1 },
	{ id: '3', type: 'image', source: 'upload', url: 'https://example.com/3.jpg', order: 2 },
];

describe('useMediaTransition', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns null previousItem initially', () => {
		const { result } = renderHook(() =>
			useMediaTransition(defaultSettings, 0, 0, mockItems),
		);
		expect(result.current.previousItem).toBeNull();
	});

	it('exposes enterRef and exitRef', () => {
		const { result } = renderHook(() =>
			useMediaTransition(defaultSettings, 0, 0, mockItems),
		);
		expect(result.current.enterRef).toBeDefined();
		expect(result.current.exitRef).toBeDefined();
	});

	it('beginTransition calls the navigate callback', () => {
		const { result } = renderHook(() =>
			useMediaTransition(defaultSettings, 0, 1, mockItems),
		);
		const navigate = vi.fn();

		act(() => {
			result.current.beginTransition(navigate);
		});

		expect(navigate).toHaveBeenCalledOnce();
	});

	it('beginTransition sets previousItem to the current item', () => {
		const { result } = renderHook(() =>
			useMediaTransition(defaultSettings, 0, 1, mockItems),
		);

		act(() => {
			result.current.beginTransition(vi.fn());
		});

		expect(result.current.previousItem).toEqual(mockItems[0]);
	});

	it('previousItem clears after duration + 100 ms', () => {
		const { result } = renderHook(() =>
			useMediaTransition(defaultSettings, 0, 1, mockItems),
		);

		act(() => {
			result.current.beginTransition(vi.fn());
		});

		expect(result.current.previousItem).toEqual(mockItems[0]);

		act(() => {
			vi.advanceTimersByTime(401);
		});

		expect(result.current.previousItem).toBeNull();
	});

	it('clearPrevious resets previousItem to null immediately', () => {
		const { result } = renderHook(() =>
			useMediaTransition(defaultSettings, 0, 1, mockItems),
		);

		act(() => {
			result.current.beginTransition(vi.fn());
		});
		act(() => {
			result.current.clearPrevious();
		});

		expect(result.current.previousItem).toBeNull();
	});

	it('setPreviousForJump sets previousItem with auto-clear', () => {
		const { result } = renderHook(() =>
			useMediaTransition(defaultSettings, 0, 0, mockItems),
		);

		act(() => {
			result.current.setPreviousForJump(mockItems[2]);
		});

		expect(result.current.previousItem).toEqual(mockItems[2]);

		act(() => {
			vi.advanceTimersByTime(401);
		});

		expect(result.current.previousItem).toBeNull();
	});

	it('does not set previousItem when animation style is instant', () => {
		const instantSettings: GalleryBehaviorSettings = {
			...defaultSettings,
			scrollAnimationStyle: 'instant',
		} as unknown as GalleryBehaviorSettings;

		const { result } = renderHook(() =>
			useMediaTransition(instantSettings, 0, 1, mockItems),
		);

		act(() => {
			result.current.beginTransition(vi.fn());
		});

		expect(result.current.previousItem).toBeNull();
	});
});
