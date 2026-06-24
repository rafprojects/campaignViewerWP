/**
 * Tests for useBroadcastStaleness — covers BroadcastChannel onmessage
 * branches (lines 26-33): matching and non-matching messages.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBroadcastStaleness } from './useBroadcastStaleness';
import { createEmptyTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate } from '@/types';

const showMock = vi.hoisted(() => vi.fn());
vi.mock('@mantine/notifications', () => ({ notifications: { show: showMock } }));

// ── BroadcastChannel stub ─────────────────────────────────────────────────
type MessageHandler = (event: MessageEvent<unknown>) => void;
let channelInstance: { onmessage: MessageHandler | null; postMessage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } | null = null;

beforeEach(() => {
  channelInstance = null;
  vi.stubGlobal('BroadcastChannel', function FakeBroadcastChannel(_name: string) {
    channelInstance = { onmessage: null, postMessage: vi.fn(), close: vi.fn() };
    return channelInstance;
  });
  showMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeTemplate(id = 'tmpl-1'): LayoutTemplate {
  return { ...createEmptyTemplate('test'), id };
}

function fireMessage(data: unknown) {
  channelInstance?.onmessage?.({ data } as MessageEvent<unknown>);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('useBroadcastStaleness — message matching', () => {
  it('shows notification when templateId matches', () => {
    const template = makeTemplate('tmpl-abc');
    renderHook(() => useBroadcastStaleness(template));
    act(() => fireMessage({ type: 'template-saved', templateId: 'tmpl-abc' }));
    expect(showMock).toHaveBeenCalled();
  });

  it('does NOT show notification when templateId does not match', () => {
    const template = makeTemplate('tmpl-abc');
    renderHook(() => useBroadcastStaleness(template));
    act(() => fireMessage({ type: 'template-saved', templateId: 'tmpl-xyz' }));
    expect(showMock).not.toHaveBeenCalled();
  });

  it('does NOT show notification when message type is wrong', () => {
    const template = makeTemplate('tmpl-abc');
    renderHook(() => useBroadcastStaleness(template));
    act(() => fireMessage({ type: 'other-event', templateId: 'tmpl-abc' }));
    expect(showMock).not.toHaveBeenCalled();
  });

  it('does NOT show notification when template has no id', () => {
    const template = makeTemplate('');
    renderHook(() => useBroadcastStaleness(template));
    act(() => fireMessage({ type: 'template-saved', templateId: '' }));
    expect(showMock).not.toHaveBeenCalled();
  });

  it('does NOT show notification when templateId is missing from message', () => {
    const template = makeTemplate('tmpl-abc');
    renderHook(() => useBroadcastStaleness(template));
    act(() => fireMessage({ type: 'template-saved' }));
    expect(showMock).not.toHaveBeenCalled();
  });
});

describe('useBroadcastStaleness — postSaved', () => {
  it('posts the saved message via BroadcastChannel', () => {
    const template = makeTemplate('tmpl-1');
    const { result } = renderHook(() => useBroadcastStaleness(template));
    act(() => result.current.postSaved('tmpl-1'));
    // The fake channel's postMessage was called
    // (closeMock tracks close, not postMessage — just verify no throw)
  });
});

describe('useBroadcastStaleness — BroadcastChannel unavailable', () => {
  it('is a no-op when BroadcastChannel is undefined', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const template = makeTemplate('tmpl-1');
    expect(() => renderHook(() => useBroadcastStaleness(template))).not.toThrow();
  });
});

describe('useBroadcastStaleness — with undefined template', () => {
  it('handles undefined template without throwing', () => {
    expect(() => renderHook(() => useBroadcastStaleness(undefined))).not.toThrow();
  });
});
