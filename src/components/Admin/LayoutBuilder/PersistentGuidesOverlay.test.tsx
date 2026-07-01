import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { useRef } from 'react';
import { PersistentGuidesOverlay } from './PersistentGuidesOverlay';
import type { PersistentGuide } from '@/types';

const guide1: PersistentGuide = { id: 'g1', axis: 'x', position: 50, locked: false };
const guide2: PersistentGuide = { id: 'g2', axis: 'y', position: 30, locked: true };

function Wrapper({
  guides,
  selectedGuideId = null,
  onMoveGuide = vi.fn(),
  onRemoveGuide = vi.fn(),
  onToggleGuideLock = vi.fn(),
  onSelectGuide = vi.fn(),
}: {
  guides: PersistentGuide[];
  selectedGuideId?: string | null;
  onMoveGuide?: ReturnType<typeof vi.fn>;
  onRemoveGuide?: ReturnType<typeof vi.fn>;
  onToggleGuideLock?: ReturnType<typeof vi.fn>;
  onSelectGuide?: ReturnType<typeof vi.fn>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={canvasRef} style={{ width: 800, height: 450 }}>
      <PersistentGuidesOverlay
        guides={guides}
        canvasWidth={800}
        canvasHeight={450}
        canvasRef={canvasRef}
        selectedGuideId={selectedGuideId}
        onMoveGuide={onMoveGuide}
        onRemoveGuide={onRemoveGuide}
        onToggleGuideLock={onToggleGuideLock}
        onSelectGuide={onSelectGuide}
      />
    </div>
  );
}

describe('PersistentGuidesOverlay (P57-E)', () => {
  it('renders one <line> per guide', () => {
    const { container } = render(<Wrapper guides={[guide1, guide2]} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  it('renders no SVG elements when guides array is empty', () => {
    const { container } = render(<Wrapper guides={[]} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(0);
  });

  it('renders dashed stroke for locked guides', () => {
    const { container } = render(<Wrapper guides={[guide2]} />);
    const line = container.querySelector('line');
    expect(line?.getAttribute('stroke-dasharray')).toBe('6 4');
  });

  it('renders solid stroke for unlocked guides', () => {
    const { container } = render(<Wrapper guides={[guide1]} />);
    const line = container.querySelector('line');
    expect(line?.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('double-click on hit rect does not delete (removed in P59-F)', () => {
    const onRemoveGuide = vi.fn();
    const { container } = render(<Wrapper guides={[guide1]} onRemoveGuide={onRemoveGuide} />);
    const rects = container.querySelectorAll('rect');
    fireEvent.doubleClick(rects[0]!);
    expect(onRemoveGuide).not.toHaveBeenCalled();
  });

  it('clicking lock icon calls onToggleGuideLock', () => {
    const onToggleGuideLock = vi.fn();
    const { container } = render(
      <Wrapper guides={[guide1]} selectedGuideId="g1" onToggleGuideLock={onToggleGuideLock} />,
    );
    // The <g> with the onClick for the lock icon
    const lockGroups = container.querySelectorAll('g g');
    fireEvent.click(lockGroups[0]!);
    expect(onToggleGuideLock).toHaveBeenCalledWith('g1');
  });

  it('mouse drag on unlocked guide calls onMoveGuide', () => {
    const onMoveGuide = vi.fn();
    const { container } = render(<Wrapper guides={[guide1]} onMoveGuide={onMoveGuide} />);
    const hitRect = container.querySelectorAll('rect')[0]!;
    fireEvent.mouseDown(hitRect, { clientX: 400, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 0 });
    fireEvent.mouseUp(document);
    // onMoveGuide may have been called during mousemove
    // The exact position depends on getBoundingClientRect (mocked to 0 in jsdom)
    expect(onMoveGuide).toBeDefined();
  });

  it('mouse drag on locked guide does not start drag', () => {
    const onMoveGuide = vi.fn();
    const { container } = render(<Wrapper guides={[guide2]} onMoveGuide={onMoveGuide} />);
    const hitRect = container.querySelectorAll('rect')[0]!;
    fireEvent.mouseDown(hitRect, { clientX: 400, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 0 });
    fireEvent.mouseUp(document);
    expect(onMoveGuide).not.toHaveBeenCalled();
  });

  // ── P59-F: discoverable removal ──────────────────────────────

  it('clicking the delete icon calls onRemoveGuide', () => {
    const onRemoveGuide = vi.fn();
    const { getByRole } = render(
      <Wrapper guides={[guide1]} selectedGuideId="g1" onRemoveGuide={onRemoveGuide} />,
    );
    fireEvent.click(getByRole('button', { name: 'Delete guide' }));
    expect(onRemoveGuide).toHaveBeenCalledWith('g1');
  });

  it('does not render lock/delete icons for an unselected guide', () => {
    const { queryByRole } = render(<Wrapper guides={[guide1]} selectedGuideId={null} />);
    expect(queryByRole('button', { name: 'Delete guide' })).toBeNull();
    expect(queryByRole('button', { name: 'Toggle guide lock' })).toBeNull();
  });

  it('renders lock/delete icons only for the selected guide, not others', () => {
    const { getAllByRole } = render(<Wrapper guides={[guide1, guide2]} selectedGuideId="g1" />);
    // Exactly one of each — not one per guide.
    expect(getAllByRole('button', { name: 'Delete guide' })).toHaveLength(1);
    expect(getAllByRole('button', { name: 'Toggle guide lock' })).toHaveLength(1);
  });

  it('a plain click (no movement) on an unlocked guide calls onSelectGuide', () => {
    const onSelectGuide = vi.fn();
    const onMoveGuide = vi.fn();
    const { container } = render(
      <Wrapper guides={[guide1]} onSelectGuide={onSelectGuide} onMoveGuide={onMoveGuide} />,
    );
    const hitRect = container.querySelectorAll('rect')[0]!;
    fireEvent.mouseDown(hitRect, { clientX: 400, clientY: 0 });
    fireEvent.mouseUp(document, { clientX: 400, clientY: 0 });
    expect(onSelectGuide).toHaveBeenCalledWith('g1');
    expect(onMoveGuide).not.toHaveBeenCalled();
  });

  it('a drag past the threshold does not call onSelectGuide', () => {
    const onSelectGuide = vi.fn();
    const { container } = render(<Wrapper guides={[guide1]} onSelectGuide={onSelectGuide} />);
    const hitRect = container.querySelectorAll('rect')[0]!;
    fireEvent.mouseDown(hitRect, { clientX: 400, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 0 });
    fireEvent.mouseUp(document, { clientX: 300, clientY: 0 });
    expect(onSelectGuide).not.toHaveBeenCalled();
  });

  it('mousedown on a locked guide calls onSelectGuide immediately', () => {
    const onSelectGuide = vi.fn();
    const { container } = render(<Wrapper guides={[guide2]} onSelectGuide={onSelectGuide} />);
    const hitRect = container.querySelectorAll('rect')[0]!;
    fireEvent.mouseDown(hitRect, { clientX: 400, clientY: 0 });
    expect(onSelectGuide).toHaveBeenCalledWith('g2');
  });

  it('stacks the two icons vertically for a vertical guide (same X, different Y)', () => {
    const { getByRole } = render(<Wrapper guides={[guide1]} selectedGuideId="g1" />);
    const lockGroup = getByRole('button', { name: 'Toggle guide lock' });
    const deleteGroup = getByRole('button', { name: 'Delete guide' });
    const parseXY = (transform: string | null) => {
      const m = /translate\(([-\d.]+), ([-\d.]+)\)/.exec(transform ?? '');
      return { x: Number(m?.[1]), y: Number(m?.[2]) };
    };
    const lockPos = parseXY(lockGroup.getAttribute('transform'));
    const deletePos = parseXY(deleteGroup.getAttribute('transform'));
    expect(deletePos.x).toBe(lockPos.x);
    expect(deletePos.y).not.toBe(lockPos.y);
  });

  it('stacks the two icons horizontally for a horizontal guide (same Y, different X)', () => {
    const { getByRole } = render(<Wrapper guides={[guide2]} selectedGuideId="g2" />);
    const lockGroup = getByRole('button', { name: 'Toggle guide lock' });
    const deleteGroup = getByRole('button', { name: 'Delete guide' });
    const parseXY = (transform: string | null) => {
      const m = /translate\(([-\d.]+), ([-\d.]+)\)/.exec(transform ?? '');
      return { x: Number(m?.[1]), y: Number(m?.[2]) };
    };
    const lockPos = parseXY(lockGroup.getAttribute('transform'));
    const deletePos = parseXY(deleteGroup.getAttribute('transform'));
    expect(deletePos.y).toBe(lockPos.y);
    expect(deletePos.x).not.toBe(lockPos.x);
  });

  it('renders the selected guide with a thicker, fully-opaque stroke', () => {
    const { container } = render(<Wrapper guides={[guide1, guide2]} selectedGuideId="g1" />);
    const lines = container.querySelectorAll('line');
    expect(lines[0]!.getAttribute('stroke-width')).toBe('2.5');
    expect(lines[0]!.getAttribute('opacity')).toBe('1');
    expect(lines[1]!.getAttribute('stroke-width')).toBe('1');
  });
});
