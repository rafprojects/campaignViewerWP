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

	function useEmblaCarousel(options: Record<string, unknown> = {}) {
		const stateRef = React.useRef<{
			selected: number;
			total: number;
			loop: boolean;
			listeners: Record<string, Set<(...args: unknown[]) => void>>;
			api: ReturnType<typeof buildApi> | null;
		} | null>(null);
		const [, setTick] = React.useState(0);

		if (!stateRef.current) {
			const s = {
				selected: 0,
				total: 0,
				loop: (options.loop as boolean) ?? true,
				listeners: {} as Record<string, Set<(...args: unknown[]) => void>>,
				api: null as ReturnType<typeof buildApi> | null,
			};

			function fire(event: string) {
				s.listeners[event]?.forEach((fn) => fn(s.api));
			}

			function buildApi() {
				return {
					scrollPrev: () => {
						if (s.total === 0) return;
						s.selected = s.loop
							? (s.selected - 1 + s.total) % s.total
							: Math.max(0, s.selected - 1);
						fire('select');
						fire('slidesInView');
						setTick((c) => c + 1);
					},
					scrollNext: () => {
						if (s.total === 0) return;
						s.selected = s.loop
							? (s.selected + 1) % s.total
							: Math.min(s.total - 1, s.selected + 1);
						fire('select');
						fire('slidesInView');
						setTick((c) => c + 1);
					},
					scrollTo: (index: number) => {
						if (s.total === 0) return;
						s.selected = Math.max(0, Math.min(s.total - 1, index));
						fire('select');
						fire('slidesInView');
						setTick((c) => c + 1);
					},
					selectedScrollSnap: () => s.selected,
					slidesInView: () => [s.selected],
					on: (event: string, cb: (...args: unknown[]) => void) => {
						if (!s.listeners[event]) s.listeners[event] = new Set();
						s.listeners[event].add(cb);
						return s.api;
					},
					off: (event: string, cb: (...args: unknown[]) => void) => {
						s.listeners[event]?.delete(cb);
						return s.api;
					},
					canScrollPrev: () => true,
					canScrollNext: () => true,
					destroy: () => {},
					reInit: () => {},
				};
			}

			s.api = buildApi();
			stateRef.current = s;
		}

		const ref = React.useCallback((node: HTMLElement | null) => {
			if (node && stateRef.current) {
				const container = node.firstElementChild;
				stateRef.current.total = container ? container.children.length : 0;
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
