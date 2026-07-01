import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { createRef } from 'react';
import type { DockviewApi } from 'dockview';
import { LayoutBuilderMenuBar, type LayoutBuilderMenuBarProps } from './LayoutBuilderMenuBar';

function makeProps(overrides: Partial<LayoutBuilderMenuBarProps> = {}): LayoutBuilderMenuBarProps {
  return {
    canUndo: false,
    canRedo: false,
    hasSelection: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onOpenHistory: vi.fn(),
    onOpenGridGenerator: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    showGrid: false,
    setShowGrid: vi.fn(),
    showRulers: false,
    setShowRulers: vi.fn(),
    showMeasurements: false,
    setShowMeasurements: vi.fn(),
    dockApiRef: createRef<DockviewApi | null>(),
    templateId: 'tpl-1',
    rootId: 'root-1',
    layoutScope: 'global',
    setLayoutScope: vi.fn(),
    guideCount: 0,
    onClearGuides: vi.fn(),
    ...overrides,
  };
}

describe('LayoutBuilderMenuBar — Clear guides (P59-F)', () => {
  it('is disabled when there are no guides', () => {
    render(<LayoutBuilderMenuBar {...makeProps({ guideCount: 0 })} />);
    fireEvent.click(screen.getByText('View'));
    const item = screen.getByText('Clear guides').closest('[role="menuitem"]');
    expect(item).toHaveAttribute('data-disabled', 'true');
  });

  it('is enabled and calls onClearGuides when guides exist', () => {
    const onClearGuides = vi.fn();
    render(<LayoutBuilderMenuBar {...makeProps({ guideCount: 3, onClearGuides })} />);
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Clear guides'));
    expect(onClearGuides).toHaveBeenCalledTimes(1);
  });
});
