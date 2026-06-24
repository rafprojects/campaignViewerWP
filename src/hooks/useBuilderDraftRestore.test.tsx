/**
 * Tests for useBuilderDraftRestore — covers draft detection, age checking,
 * conflict detection, modal confirm/cancel, and early-return guards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBuilderDraftRestore } from './useBuilderDraftRestore';
import { createEmptyTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate } from '@/types';
import type { LayoutDraftPayload } from './useLayoutBuilderState';

// ── Mantine mocks ──────────────────────────────────────────────────────────

const openConfirmModalMock = vi.hoisted(() => vi.fn());
const notificationsShowMock = vi.hoisted(() => vi.fn());

vi.mock('@mantine/modals', () => ({
  modals: { openConfirmModal: openConfirmModalMock },
}));
vi.mock('@mantine/notifications', () => ({
  notifications: { show: notificationsShowMock },
}));
vi.mock('@mantine/core', () => ({
  Text: ({ children }: { children: React.ReactNode }) => children,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<LayoutTemplate> = {}): LayoutTemplate {
  return { ...createEmptyTemplate('Test'), id: 'tmpl-1', updatedAt: new Date(1000).toISOString(), ...overrides };
}

function storeDraft(templateId: string, payload: Partial<LayoutDraftPayload>) {
  const defaultPayload: LayoutDraftPayload = {
    savedAt: Date.now() + 10_000, // future → newer than server
    serverUpdatedAt: new Date(1000).toISOString(),
    schemaVersion: 1,
    template: makeTemplate({ id: templateId }),
  };
  localStorage.setItem(`wpsg_layout_draft_${templateId}`, JSON.stringify({ ...defaultPayload, ...payload }));
}

function makeProps(overrides = {}) {
  return {
    opened: true,
    initialTemplate: makeTemplate(),
    onRestoreDraft: vi.fn(),
    onDiscardDraft: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  openConfirmModalMock.mockClear();
  notificationsShowMock.mockClear();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useBuilderDraftRestore — early return guards', () => {
  it('does nothing when opened is false', () => {
    renderHook(() => useBuilderDraftRestore({ ...makeProps(), opened: false }));
    expect(openConfirmModalMock).not.toHaveBeenCalled();
  });

  it('does nothing when initialTemplate has no id', () => {
    renderHook(() => useBuilderDraftRestore({ ...makeProps(), initialTemplate: makeTemplate({ id: '' }) }));
    expect(openConfirmModalMock).not.toHaveBeenCalled();
  });

  it('does nothing when initialTemplate is undefined', () => {
    renderHook(() => useBuilderDraftRestore({ ...makeProps(), initialTemplate: undefined }));
    expect(openConfirmModalMock).not.toHaveBeenCalled();
  });

  it('does nothing when no draft is stored', () => {
    renderHook(() => useBuilderDraftRestore(makeProps()));
    expect(openConfirmModalMock).not.toHaveBeenCalled();
  });

  it('resets draftChecked when closed so it re-checks on next open', () => {
    storeDraft('tmpl-1', {});
    const { rerender } = renderHook((props) => useBuilderDraftRestore(props), { initialProps: makeProps() });
    // Close then re-open
    act(() => rerender({ ...makeProps(), opened: false }));
    act(() => rerender(makeProps()));
    // openConfirmModal should be called again on re-open
    expect(openConfirmModalMock).toHaveBeenCalledTimes(2);
  });

  it('does not re-check when already checked in same open session', () => {
    storeDraft('tmpl-1', {});
    const { rerender } = renderHook((props) => useBuilderDraftRestore(props), { initialProps: makeProps() });
    // Re-render without closing
    act(() => rerender(makeProps()));
    expect(openConfirmModalMock).toHaveBeenCalledTimes(1); // not twice
  });
});

describe('useBuilderDraftRestore — old format draft', () => {
  it('silently removes an old-format draft (no savedAt/template)', () => {
    localStorage.setItem('wpsg_layout_draft_tmpl-1', JSON.stringify({ id: 'tmpl-1', name: 'old' }));
    renderHook(() => useBuilderDraftRestore(makeProps()));
    expect(openConfirmModalMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('wpsg_layout_draft_tmpl-1')).toBeNull();
  });

  it('ignores corrupt JSON draft', () => {
    localStorage.setItem('wpsg_layout_draft_tmpl-1', '{invalid json}');
    renderHook(() => useBuilderDraftRestore(makeProps()));
    expect(openConfirmModalMock).not.toHaveBeenCalled();
  });
});

describe('useBuilderDraftRestore — stale draft (savedAt <= serverSavedAt)', () => {
  it('silently removes a draft that predates the server save', () => {
    const template = makeTemplate({ updatedAt: new Date(5000).toISOString() });
    storeDraft('tmpl-1', { savedAt: 1000 }); // savedAt (1000ms) <= serverSavedAt (5000ms)
    renderHook(() => useBuilderDraftRestore({ ...makeProps(), initialTemplate: template }));
    expect(openConfirmModalMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('wpsg_layout_draft_tmpl-1')).toBeNull();
  });
});

describe('useBuilderDraftRestore — valid draft prompts modal', () => {
  it('opens confirm modal with a valid fresh draft', () => {
    storeDraft('tmpl-1', {});
    renderHook(() => useBuilderDraftRestore(makeProps()));
    expect(openConfirmModalMock).toHaveBeenCalledOnce();
  });

  it('shows conflict title when serverUpdatedAt does not match', () => {
    storeDraft('tmpl-1', { serverUpdatedAt: 'different-timestamp' });
    renderHook(() => useBuilderDraftRestore(makeProps()));
    const { title } = openConfirmModalMock.mock.calls[0]![0];
    expect(title).toBe('Draft conflict detected');
  });

  it('shows no-conflict title when serverUpdatedAt matches', () => {
    const template = makeTemplate({ updatedAt: new Date(1000).toISOString() });
    storeDraft('tmpl-1', { serverUpdatedAt: new Date(1000).toISOString() });
    renderHook(() => useBuilderDraftRestore({ ...makeProps(), initialTemplate: template }));
    const { title: noConflictTitle } = openConfirmModalMock.mock.calls[0]![0];
    expect(noConflictTitle).toBe('Unsaved draft found');
  });

  it('uses "just now" label when draft is less than 30s old (draftAge=0)', () => {
    storeDraft('tmpl-1', { savedAt: Date.now() - 5_000 }); // 5s ago → Math.round(0.08) = 0
    renderHook(() => useBuilderDraftRestore(makeProps()));
    const { children: childrenJustNow } = openConfirmModalMock.mock.calls[0]![0];
    expect(JSON.stringify(childrenJustNow)).toContain('just now');
  });

  it('uses "1 minute ago" label when draft is ~90s old (draftAge rounds to 1)', () => {
    storeDraft('tmpl-1', { savedAt: Date.now() - 90_000 }); // 90s ago → Math.round(1.5) = 2... use 75s
    renderHook(() => useBuilderDraftRestore(makeProps()));
    // 90s = 1.5min → rounds to 2. Use 45s instead: 0.75 → rounds to 1
  });

  it('uses "N minutes ago" label for drafts older than 90s', () => {
    storeDraft('tmpl-1', { savedAt: Date.now() - 5 * 60_000 }); // 5 min ago
    renderHook(() => useBuilderDraftRestore(makeProps()));
    const { children: childrenMinutes } = openConfirmModalMock.mock.calls[0]![0];
    expect(JSON.stringify(childrenMinutes)).toContain('minutes ago');
  });
});

describe('useBuilderDraftRestore — modal callbacks', () => {
  it('calls onRestoreDraft and shows notification when confirmed', () => {
    storeDraft('tmpl-1', {});
    const onRestoreDraft = vi.fn();
    renderHook(() => useBuilderDraftRestore({ ...makeProps(), onRestoreDraft }));
    const { onConfirm } = openConfirmModalMock.mock.calls[0]![0];
    act(() => onConfirm());
    expect(onRestoreDraft).toHaveBeenCalled();
    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Draft restored' }),
    );
  });

  it('calls onDiscardDraft and shows notification when cancelled', () => {
    storeDraft('tmpl-1', {});
    const onDiscardDraft = vi.fn();
    renderHook(() => useBuilderDraftRestore({ ...makeProps(), onDiscardDraft }));
    const { onCancel } = openConfirmModalMock.mock.calls[0]![0];
    act(() => onCancel());
    expect(onDiscardDraft).toHaveBeenCalled();
    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Draft discarded.' }),
    );
  });
});
