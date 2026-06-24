/**
 * Tests for useLayoutBuilderFileIO — covers export JSON, import JSON branches
 * (file absent, invalid JSON, missing fields, valid file).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutBuilderFileIO } from './useLayoutBuilderFileIO';
import { createEmptyTemplate } from './useLayoutBuilderState';
import type { UseLayoutBuilderReturn } from './useLayoutBuilderState';

const showMock = vi.hoisted(() => vi.fn());
vi.mock('@mantine/notifications', () => ({ notifications: { show: showMock } }));

// URL.createObjectURL / revokeObjectURL are already stubbed in src/test/setup.ts

function makeBuilder(templateOverrides = {}): UseLayoutBuilderReturn {
  const template = { ...createEmptyTemplate('My Layout'), ...templateOverrides };
  return {
    template,
    setTemplate: vi.fn(),
  } as unknown as UseLayoutBuilderReturn;
}

function buildChangeEvent(content: string | null): React.ChangeEvent<HTMLInputElement> {
  if (content === null) {
    return { target: { files: null, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
  }
  const file = new File([content], 'layout.json', { type: 'application/json' });
  return {
    target: {
      files: { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) },
      value: '',
    },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

beforeEach(() => {
  showMock.mockClear();
});

// ── handleExportJson ──────────────────────────────────────────────────────

describe('handleExportJson', () => {
  it('creates a download link and clicks it', () => {
    const clickMock = vi.fn();
    const realCreate = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag, ...rest) => {
      if (tag === 'a') return { href: '', download: '', click: clickMock } as unknown as HTMLAnchorElement;
      return realCreate(tag, ...rest as [ElementCreationOptions?]);
    });

    const builder = makeBuilder();
    const { result } = renderHook(() => useLayoutBuilderFileIO({ builder }));
    act(() => result.current.handleExportJson());

    expect(clickMock).toHaveBeenCalled();
    createElementSpy.mockRestore();
  });
});

// ── handleImportJson — no file ─────────────────────────────────────────────

describe('handleImportJson — no file', () => {
  it('is a no-op when files is null', () => {
    const builder = makeBuilder();
    const { result } = renderHook(() => useLayoutBuilderFileIO({ builder }));
    act(() => result.current.handleImportJson(buildChangeEvent(null)));
    expect(builder.setTemplate).not.toHaveBeenCalled();
  });
});

// ── handleImportJson — valid JSON ──────────────────────────────────────────

describe('handleImportJson — valid JSON', () => {
  it('calls setTemplate with the imported layout', async () => {
    const validLayout = { name: 'Imported', slots: [], canvasAspectRatio: 1.5, overlays: [] };
    const builder = makeBuilder();
    const { result } = renderHook(() => useLayoutBuilderFileIO({ builder }));
    act(() => result.current.handleImportJson(buildChangeEvent(JSON.stringify(validLayout))));
    await vi.waitFor(() => expect(builder.setTemplate).toHaveBeenCalled());
    const [imported] = (builder.setTemplate as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(imported.name).toBe('Imported');
  });
});

// ── handleImportJson — missing required fields ─────────────────────────────

describe('handleImportJson — missing fields', () => {
  it('shows error notification when canvasAspectRatio is missing', async () => {
    const invalid = { name: 'Bad', slots: [] };
    const builder = makeBuilder();
    const { result } = renderHook(() => useLayoutBuilderFileIO({ builder }));
    act(() => result.current.handleImportJson(buildChangeEvent(JSON.stringify(invalid))));
    await vi.waitFor(() => expect(showMock).toHaveBeenCalled());
    expect(builder.setTemplate).not.toHaveBeenCalled();
  });

  it('shows error when parsed value is null', async () => {
    const builder = makeBuilder();
    const { result } = renderHook(() => useLayoutBuilderFileIO({ builder }));
    act(() => result.current.handleImportJson(buildChangeEvent('null')));
    await vi.waitFor(() => expect(showMock).toHaveBeenCalled());
  });

  it('shows error when slots is not an array', async () => {
    const invalid = { name: 'X', slots: 'not-array', canvasAspectRatio: 1 };
    const builder = makeBuilder();
    const { result } = renderHook(() => useLayoutBuilderFileIO({ builder }));
    act(() => result.current.handleImportJson(buildChangeEvent(JSON.stringify(invalid))));
    await vi.waitFor(() => expect(showMock).toHaveBeenCalled());
  });

  it('shows error when name field is missing', async () => {
    const invalid = { slots: [], canvasAspectRatio: 1 };
    const builder = makeBuilder();
    const { result } = renderHook(() => useLayoutBuilderFileIO({ builder }));
    act(() => result.current.handleImportJson(buildChangeEvent(JSON.stringify(invalid))));
    await vi.waitFor(() => expect(showMock).toHaveBeenCalled());
  });
});

// ── handleImportJson — invalid JSON ───────────────────────────────────────

describe('handleImportJson — invalid JSON', () => {
  it('shows a parse error notification for malformed JSON', async () => {
    const builder = makeBuilder();
    const { result } = renderHook(() => useLayoutBuilderFileIO({ builder }));
    act(() => result.current.handleImportJson(buildChangeEvent('{not:valid:json}')));
    await vi.waitFor(() => expect(showMock).toHaveBeenCalled());
    expect(builder.setTemplate).not.toHaveBeenCalled();
  });
});
