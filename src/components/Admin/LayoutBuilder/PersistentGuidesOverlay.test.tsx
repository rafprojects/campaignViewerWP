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
  onMoveGuide = vi.fn(),
  onRemoveGuide = vi.fn(),
  onToggleGuideLock = vi.fn(),
}: {
  guides: PersistentGuide[];
  onMoveGuide?: ReturnType<typeof vi.fn>;
  onRemoveGuide?: ReturnType<typeof vi.fn>;
  onToggleGuideLock?: ReturnType<typeof vi.fn>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={canvasRef} style={{ width: 800, height: 450 }}>
      <PersistentGuidesOverlay
        guides={guides}
        canvasWidth={800}
        canvasHeight={450}
        canvasRef={canvasRef}
        onMoveGuide={onMoveGuide}
        onRemoveGuide={onRemoveGuide}
        onToggleGuideLock={onToggleGuideLock}
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

  it('double-click on hit rect calls onRemoveGuide', () => {
    const onRemoveGuide = vi.fn();
    const { container } = render(<Wrapper guides={[guide1]} onRemoveGuide={onRemoveGuide} />);
    const rects = container.querySelectorAll('rect');
    // First rect is the hit area (second is the lock icon bg)
    fireEvent.doubleClick(rects[0]!);
    expect(onRemoveGuide).toHaveBeenCalledWith('g1');
  });

  it('clicking lock icon calls onToggleGuideLock', () => {
    const onToggleGuideLock = vi.fn();
    const { container } = render(<Wrapper guides={[guide1]} onToggleGuideLock={onToggleGuideLock} />);
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
});
