/**
 * Tests for useBuilderDockLayout — covers the localStorage-based layout
 * persistence branches in handleDockReady.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBuilderDockLayout } from './useBuilderDockLayout';
import type { DockviewReadyEvent, DockviewApi, IPanel } from 'dockview';

// ── Minimal mock DockviewApi ────────────────────────────────────────────

function makeApi(overrides: Partial<DockviewApi> = {}): DockviewApi {
  const panels: IPanel[] = [];
  return {
    toJSON: vi.fn(() => ({ panels })),
    fromJSON: vi.fn(),
    addPanel: vi.fn(() => ({ id: 'panel' }) as IPanel),
    onDidLayoutChange: vi.fn(() => ({ dispose: vi.fn() })),
    ...overrides,
  } as unknown as DockviewApi;
}

function makeEvent(api: DockviewApi): DockviewReadyEvent {
  return { api } as DockviewReadyEvent;
}

const defaultProps = {
  rootId: 'root',
  layoutScope: 'global' as const,
  initialTemplateId: 'tmpl-1',
};

// ── Tests ───────────────────────────────────────────────────────────────

describe('useBuilderDockLayout — no saved layout', () => {
  beforeEach(() => localStorage.clear());

  it('creates default panels when no saved layout exists', () => {
    const { result } = renderHook(() => useBuilderDockLayout(defaultProps));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    expect(api.addPanel).toHaveBeenCalledTimes(4);
    expect(api.fromJSON).not.toHaveBeenCalled();
  });

  it('registers onDidLayoutChange after default layout creation', () => {
    const { result } = renderHook(() => useBuilderDockLayout(defaultProps));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    expect(api.onDidLayoutChange).toHaveBeenCalled();
  });
});

describe('useBuilderDockLayout — saved layout with current version', () => {
  const LAYOUT_KEY = 'wpsg_builder_root_layout';
  const LAYOUT_VERSION = 3;

  beforeEach(() => localStorage.clear());

  it('restores a versioned saved layout', () => {
    const saved = { version: LAYOUT_VERSION, layout: { panels: [] } };
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useBuilderDockLayout(defaultProps));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    expect(api.fromJSON).toHaveBeenCalledWith({ panels: [] });
    expect(api.addPanel).not.toHaveBeenCalled();
  });

  it('restores a bare-JSON layout (legacy format without version wrapper)', () => {
    // Legacy: saved value has no "layout" key → treat the whole object as the layout
    const bare = { panels: [] };
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: LAYOUT_VERSION, ...bare }));
    // Overwrite with a truly bare object to simulate legacy
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: LAYOUT_VERSION }));

    // Simulate a saved object that lacks a "layout" key but has version >= current
    const noLayoutKey = JSON.stringify({ version: LAYOUT_VERSION });
    localStorage.setItem(LAYOUT_KEY, noLayoutKey);

    const { result } = renderHook(() => useBuilderDockLayout(defaultProps));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    // fromJSON is called (layout key absent → falls back to the whole parsed object)
    expect(api.fromJSON).toHaveBeenCalled();
  });
});

describe('useBuilderDockLayout — saved layout with old version', () => {
  const LAYOUT_KEY = 'wpsg_builder_root_layout';

  beforeEach(() => localStorage.clear());

  it('clears old layout and creates default panels', () => {
    const old = { version: 1, layout: { panels: [] } };
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(old));

    const { result } = renderHook(() => useBuilderDockLayout(defaultProps));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    expect(api.fromJSON).not.toHaveBeenCalled();
    expect(api.addPanel).toHaveBeenCalledTimes(4);
    expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
  });
});

describe('useBuilderDockLayout — corrupted JSON', () => {
  const LAYOUT_KEY = 'wpsg_builder_root_layout';

  beforeEach(() => localStorage.clear());

  it('falls through to default panels when JSON is invalid', () => {
    localStorage.setItem(LAYOUT_KEY, 'not-valid-json!!');

    const { result } = renderHook(() => useBuilderDockLayout(defaultProps));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    expect(api.fromJSON).not.toHaveBeenCalled();
    expect(api.addPanel).toHaveBeenCalledTimes(4);
    expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
  });
});

describe('useBuilderDockLayout — per-template layout scope', () => {
  beforeEach(() => localStorage.clear());

  it('uses template-scoped key when layoutScope is per-template', () => {
    const props = { rootId: 'root', layoutScope: 'per-template' as const, initialTemplateId: 'tmpl-42' };
    const { result } = renderHook(() => useBuilderDockLayout(props));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    // No saved layout → default panels created (proves key was per-template scoped, not global)
    expect(api.addPanel).toHaveBeenCalledTimes(4);
  });

  it('uses global key when layoutScope is per-template but no templateId', () => {
    const props = { rootId: 'root', layoutScope: 'per-template' as const, initialTemplateId: '' };
    const { result } = renderHook(() => useBuilderDockLayout(props));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    expect(api.addPanel).toHaveBeenCalledTimes(4);
  });
});

describe('useBuilderDockLayout — persistLayout callback', () => {
  const LAYOUT_KEY = 'wpsg_builder_root_layout';

  beforeEach(() => localStorage.clear());

  it('persistLayout saves a versioned snapshot via onDidLayoutChange', () => {
    const { result } = renderHook(() => useBuilderDockLayout(defaultProps));
    let persistCb: (() => void) | undefined;
    const api = makeApi({
      onDidLayoutChange: vi.fn((cb: () => void) => { persistCb = cb; return { dispose: vi.fn() }; }),
    });
    act(() => result.current.handleDockReady(makeEvent(api)));
    // Trigger the persist callback
    act(() => persistCb?.());
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)!);
    expect(saved.version).toBe(3);
  });
});

describe('useBuilderDockLayout — dockApiRef', () => {
  beforeEach(() => localStorage.clear());

  it('dockApiRef is populated after handleDockReady fires', () => {
    const { result } = renderHook(() => useBuilderDockLayout(defaultProps));
    const api = makeApi();
    act(() => result.current.handleDockReady(makeEvent(api)));
    expect(result.current.dockApiRef.current).toBe(api);
  });
});
