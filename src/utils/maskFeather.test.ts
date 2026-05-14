import { describe, expect, it, vi, beforeAll, beforeEach, afterEach, type Mock } from 'vitest';
import { featherMask, clearFeatherCache } from './maskFeather';

// jsdom does not implement URL.createObjectURL / revokeObjectURL — define them once.
beforeAll(() => {
	if (!URL.createObjectURL) {
		Object.defineProperty(URL, 'createObjectURL', { writable: true, configurable: true, value: vi.fn() });
	}
	if (!URL.revokeObjectURL) {
		Object.defineProperty(URL, 'revokeObjectURL', { writable: true, configurable: true, value: vi.fn() });
	}
});

// ── Setup canvas + Image mocks ────────────────────────────────

function setupMocks() {
	// URL helpers — reset the vi.fn() instances
	(URL.createObjectURL as Mock).mockReturnValue('blob:test-url');
	(URL.revokeObjectURL as Mock).mockReset();

	// HTMLImageElement — fires onload synchronously when src is assigned
	vi.spyOn(globalThis, 'Image').mockImplementation(() => {
		const img = {
			crossOrigin: '',
			naturalWidth: 100,
			naturalHeight: 100,
			onload: null as (() => void) | null,
			onerror: null as ((e: unknown) => void) | null,
		};
		Object.defineProperty(img, 'src', {
			set(_url: string) {
				img.onload?.();
			},
			get() {
				return '';
			},
		});
		return img as unknown as HTMLImageElement;
	});

	// Canvas 2D context
	const mockCtx = { filter: '', drawImage: vi.fn() };
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		mockCtx as unknown as CanvasRenderingContext2D,
	);

	// toBlob — invokes callback synchronously with a small PNG blob
	vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
		cb(new Blob(['fake-png'], { type: 'image/png' }));
	});
}

describe('maskFeather', () => {
	beforeEach(() => {
		vi.clearAllMocks(); // clear call history + reset implementations on vi.fn()s
		clearFeatherCache();
		setupMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks(); // restore vi.spyOn mocks (Image, canvas)
		clearFeatherCache();
	});

	it('returns original URL when featherPx is 0', async () => {
		const result = await featherMask('https://example.com/mask.png', 0);
		expect(result).toBe('https://example.com/mask.png');
	});

	it('returns original URL when featherPx is negative', async () => {
		const result = await featherMask('https://example.com/mask.png', -5);
		expect(result).toBe('https://example.com/mask.png');
	});

	it('returns a blob URL for a positive featherPx', async () => {
		const result = await featherMask('https://example.com/mask.png', 10);
		expect(result).toBe('blob:test-url');
	});

	it('caches result — createObjectURL called only once for same args', async () => {
		await featherMask('https://example.com/mask.png', 10);
		await featherMask('https://example.com/mask.png', 10);

		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
	});

	it('creates separate cache entries for different featherPx values', async () => {
		(URL.createObjectURL as Mock)
			.mockReturnValueOnce('blob:url-10')
			.mockReturnValueOnce('blob:url-20');

		const r1 = await featherMask('https://example.com/mask.png', 10);
		const r2 = await featherMask('https://example.com/mask.png', 20);

		expect(r1).toBe('blob:url-10');
		expect(r2).toBe('blob:url-20');
		expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
	});

	it('clearFeatherCache revokes all cached blob URLs', async () => {
		(URL.createObjectURL as Mock).mockReturnValue('blob:cached');

		await featherMask('https://example.com/mask.png', 10);
		clearFeatherCache();

		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cached');
	});
});
