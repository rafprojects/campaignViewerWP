import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
// Initialise i18next with English defaults so t() returns English strings in tests.
import '../i18n';

// JSDOM doesn't implement real navigation, so any attempt raises a "Not implemented:
// navigation (except hash changes)" jsdomError that its default virtual console forwards
// to console.error. Two things in this app trigger it during tests: window.location.reload()
// (AuthContext logout) and clicking a blob-href download anchor (JSDOM's hyperlink-follow
// logic never consults the `download` attribute, so every `a.download = …; a.click()`
// helper looks like a navigation to it). Both are JSDOM implementation-gaps, not real
// failures — the suite passes either way — but the stack traces read as a broken build.
//
// Filter out ONLY that message, and keep forwarding every other jsdomError. jsdomError is
// not just "not implemented" noise: JSDOM also routes genuine problems through it —
// uncaught exceptions thrown from event handlers (runtime-script-errors.js, `Uncaught …`),
// CSS parse errors, XHR/resource-load failures. Blanket-silencing the whole event
// (removeAllListeners, or jsdom's omitJSDOMErrors option) would swallow those too and let
// a real handler-throwing bug pass a test silently — so we replace the forwarder with a
// message-filtered one rather than removing it.
//
// This must mutate the existing virtual console in place, not replace it: vitest's jsdom
// environment proxies `window` onto Node's real `global` (`populateGlobal`) with a getter
// that forwards to the real jsdom window but a setter that only writes to a disconnected
// shadow map — so `window._virtualConsole = …` never reaches the instance jsdom's own
// internals (navigation.js et al.) read. Calling methods on the object from the getter
// mutates the real shared instance and works. (A vite.config.ts environmentOptions
// virtualConsole can't be used either: pool 'forks' IPC-serializes that config and a live
// VirtualConsole/EventEmitter can't survive it.)
{
	const virtualConsole = (window as unknown as {
		_virtualConsole: {
			removeAllListeners(event: string): void;
			on(event: string, cb: (err: Error & { detail?: unknown }) => void): void;
		};
	})._virtualConsole;
	virtualConsole.removeAllListeners('jsdomError');
	virtualConsole.on('jsdomError', (err) => {
		if (typeof err?.message === 'string' && err.message.includes('Not implemented: navigation')) {
			return;
		}
		// Preserve JSDOM's default forwarding (virtual-console.js sendTo) for everything else.
		console.error(err.stack, err.detail);
	});
}

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

if (!document.fonts) {
	Object.defineProperty(document, 'fonts', {
		configurable: true,
		value: {
			addEventListener: () => {},
			removeEventListener: () => {},
			ready: Promise.resolve(),
			status: 'loaded' as FontFaceSetLoadStatus,
			check: () => true,
			load: () => Promise.resolve([]),
		},
	});
}

// Mantine's Combobox calls scrollIntoView on list items after dropdown opens.
// JSDOM doesn't implement it, causing unhandled exception noise in tests.
if (!window.HTMLElement.prototype.scrollIntoView) {
	window.HTMLElement.prototype.scrollIntoView = function () {};
}

// JSDOM doesn't implement the PointerEvent constructor at all (longstanding gap —
// see jsdom/jsdom#2527), so @testing-library's fireEvent.pointerDown/Move/Up fall back to a
// plain Event and silently drop clientX/buttons/pointerId. Polyfill it as a thin MouseEvent
// subclass so drag-to-scrub controls can be tested.
if (typeof window.PointerEvent === 'undefined') {
	class PointerEvent extends MouseEvent {
		public pointerId: number;
		public pointerType: string;
		constructor(type: string, params: PointerEventInit = {}) {
			super(type, params);
			this.pointerId = params.pointerId ?? 0;
			this.pointerType = params.pointerType ?? 'mouse';
		}
	}
	window.PointerEvent = PointerEvent as unknown as typeof window.PointerEvent;
}

// JSDOM doesn't implement Pointer Events capture (used by drag-to-scrub controls).
if (!window.HTMLElement.prototype.setPointerCapture) {
	window.HTMLElement.prototype.setPointerCapture = function () {};
}
if (!window.HTMLElement.prototype.releasePointerCapture) {
	window.HTMLElement.prototype.releasePointerCapture = function () {};
}
if (!window.HTMLElement.prototype.hasPointerCapture) {
	window.HTMLElement.prototype.hasPointerCapture = function () { return false; };
}

// JSDOM doesn't implement URL.createObjectURL / revokeObjectURL.
// Stub them globally so any useEffect that calls URL.revokeObjectURL in cleanup
// doesn't crash when tests restore the (undefined) original value.
if (typeof URL.createObjectURL !== 'function') {
	URL.createObjectURL = () => 'blob:test';
}
if (typeof URL.revokeObjectURL !== 'function') {
	URL.revokeObjectURL = () => {};
}

afterEach(() => {
	cleanup();
	localStorage.clear();
});
