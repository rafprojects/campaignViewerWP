import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useRecentFonts } from './useRecentFonts';

describe('useRecentFonts', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns empty array when no fonts stored', () => {
		const { result } = renderHook(() => useRecentFonts());
		expect(result.current.recentFonts).toEqual([]);
	});

	it('addRecentFont adds a font to the front', () => {
		const { result } = renderHook(() => useRecentFonts());

		act(() => {
			result.current.addRecentFont('Arial');
		});

		expect(result.current.recentFonts[0]).toBe('Arial');
		expect(result.current.recentFonts).toHaveLength(1);
	});

	it('puts the most recently added font at index 0', () => {
		const { result } = renderHook(() => useRecentFonts());

		act(() => { result.current.addRecentFont('Arial'); });
		act(() => { result.current.addRecentFont('Georgia'); });

		expect(result.current.recentFonts[0]).toBe('Georgia');
		expect(result.current.recentFonts[1]).toBe('Arial');
	});

	it('moves an existing font to the front without duplicating', () => {
		const { result } = renderHook(() => useRecentFonts());

		act(() => { result.current.addRecentFont('Arial'); });
		act(() => { result.current.addRecentFont('Georgia'); });
		act(() => { result.current.addRecentFont('Arial'); });

		expect(result.current.recentFonts[0]).toBe('Arial');
		expect(result.current.recentFonts).toHaveLength(2);
	});

	it('strips CSS font-family quotes and fallbacks', () => {
		const { result } = renderHook(() => useRecentFonts());

		act(() => { result.current.addRecentFont('"Roboto", sans-serif'); });

		expect(result.current.recentFonts[0]).toBe('Roboto');
	});

	it("strips single quotes from font names", () => {
		const { result } = renderHook(() => useRecentFonts());

		act(() => { result.current.addRecentFont("'Open Sans'"); });

		expect(result.current.recentFonts[0]).toBe('Open Sans');
	});

	it('ignores empty fontFamily', () => {
		const { result } = renderHook(() => useRecentFonts());

		act(() => { result.current.addRecentFont(''); });

		expect(result.current.recentFonts).toEqual([]);
	});

	it('limits list to 8 entries', () => {
		const { result } = renderHook(() => useRecentFonts());

		act(() => {
			for (let i = 0; i < 10; i++) {
				result.current.addRecentFont(`Font${i}`);
			}
		});

		expect(result.current.recentFonts).toHaveLength(8);
	});
});
