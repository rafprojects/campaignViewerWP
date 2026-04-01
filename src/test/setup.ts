import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ── IntersectionObserver stub (needed by embla-carousel) ────────────
if (!globalThis.IntersectionObserver) {
	class IntersectionObserver {
		constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords(): IntersectionObserverEntry[] { return []; }
		get root() { return null; }
		get rootMargin() { return '0px'; }
		get thresholds(): number[] { return [0]; }
	}
	globalThis.IntersectionObserver = IntersectionObserver as unknown as typeof globalThis.IntersectionObserver;
}

// ── Embla carousel mock (JSDOM has no layout engine) ────────────────
vi.mock('embla-carousel-react', async () => {
	const React = await vi.importActual<typeof import('react')>('react');

	type EmblaListener = (...args: unknown[]) => void;
	type EmblaApi = {
		scrollPrev: () => void;
		scrollNext: () => void;
		scrollTo: (index: number) => void;
		selectedScrollSnap: () => number;
		slidesInView: () => number[];
		internalEngine: () => { options: { loop: boolean } };
		on: (event: string, cb: EmblaListener) => EmblaApi | null;
		off: (event: string, cb: EmblaListener) => EmblaApi | null;
		canScrollPrev: () => boolean;
		canScrollNext: () => boolean;
		destroy: () => void;
		reInit: () => void;
	};

	function useEmblaCarousel(options: Record<string, unknown> = {}) {
		const stateRef = React.useRef<{
			selected: number;
			total: number;
			loop: boolean;
			listeners: Record<string, Set<EmblaListener>>;
			api: EmblaApi | null;
		} | null>(null);
		const [, setTick] = React.useState(0);

		if (!stateRef.current) {
			const s = {
				selected: Math.max(0, Math.round((options.startIndex as number) ?? 0)),
				total: 0,
				loop: (options.loop as boolean) ?? true,
				listeners: {} as Record<string, Set<EmblaListener>>,
				api: null as EmblaApi | null,
			};

			function fire(event: string) {
				s.listeners[event]?.forEach((fn) => fn(s.api));
			}

				const api: EmblaApi = {
					scrollPrev: () => {
						if (s.total === 0) return;
						s.selected = s.loop
							? (s.selected - 1 + s.total) % s.total
							: Math.max(0, s.selected - 1);
						fire('select');
						fire('slidesInView');
						fire('settle');
						setTick((c) => c + 1);
					},
					scrollNext: () => {
						if (s.total === 0) return;
						s.selected = s.loop
							? (s.selected + 1) % s.total
							: Math.min(s.total - 1, s.selected + 1);
						fire('select');
						fire('slidesInView');
						fire('settle');
						setTick((c) => c + 1);
					},
					scrollTo: (index: number) => {
						if (s.total === 0) return;
						s.selected = Math.max(0, Math.min(s.total - 1, index));
						fire('select');
						fire('slidesInView');
						fire('settle');
						setTick((c) => c + 1);
					},
					selectedScrollSnap: () => s.selected,
					slidesInView: () => [s.selected],
					internalEngine: () => ({ options: { loop: s.loop } }),
					on: (event: string, cb: EmblaListener) => {
						if (!s.listeners[event]) s.listeners[event] = new Set();
						s.listeners[event].add(cb);
						return api;
					},
					off: (event: string, cb: EmblaListener) => {
						s.listeners[event]?.delete(cb);
						return api;
					},
					canScrollPrev: () => true,
					canScrollNext: () => true,
					destroy: () => {},
					reInit: () => {},
				};

			s.api = api;
			stateRef.current = s;
		}

		const ref = React.useCallback((node: HTMLElement | null) => {
			if (node && stateRef.current) {
				const container = node.firstElementChild;
				stateRef.current.total = container ? container.children.length : 0;
				stateRef.current.selected = Math.min(
					stateRef.current.selected,
					Math.max(0, stateRef.current.total - 1),
				);
			}
		}, []);

		return [ref, stateRef.current.api] as const;
	}

	return { default: useEmblaCarousel };
});

vi.mock('embla-carousel-autoplay', () => ({
	default: () => ({ name: 'autoplay', options: {}, init: () => {}, destroy: () => {} }),
}));

if (!window.matchMedia) {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}

if (!globalThis.ResizeObserver) {
	class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver = ResizeObserver;
}

// Mantine's Combobox calls scrollIntoView on list items after dropdown opens.
// JSDOM doesn't implement it, causing unhandled exception noise in tests.
if (!window.HTMLElement.prototype.scrollIntoView) {
	window.HTMLElement.prototype.scrollIntoView = function () {};
}

afterEach(() => {
	cleanup();
});
