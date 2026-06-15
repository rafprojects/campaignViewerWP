import { describe, it, expect } from 'vitest';
import {
  alignSlotsLeft,
  alignSlotsRight,
  alignSlotsTop,
  alignSlotsBottom,
  centerSlotsHorizontally,
  centerSlotsVertically,
  distributeSlotsHorizontally,
  distributeSlotsVertically,
  distributeSlotsHorizontallyByGap,
  distributeSlotsVerticallyByGap,
} from '@wp-super-gallery/shared-utils';
import type { LayoutSlot } from '@/types';

function makeSlot(id: string, x: number, y: number, width: number, height: number): LayoutSlot {
  return {
    id,
    x,
    y,
    width,
    height,
    zIndex: 1,
    shape: 'rectangle',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: '#000',
    objectFit: 'cover',
    objectPosition: '50% 50%',
    clickAction: 'lightbox',
    hoverEffect: 'none',
  };
}

const s1 = makeSlot('a', 10, 5, 20, 15);  // right=30, bottom=20, cx=20, cy=12.5
const s2 = makeSlot('b', 40, 20, 10, 30); // right=50, bottom=50, cx=45, cy=35
const s3 = makeSlot('c', 25, 10, 30, 10); // right=55, bottom=20, cx=40, cy=15

describe('alignSlotsLeft', () => {
  it('moves all slots to the leftmost x', () => {
    const result = alignSlotsLeft([s1, s2, s3]);
    expect(result['a']?.x).toBe(10);
    expect(result['b']?.x).toBe(10);
    expect(result['c']?.x).toBe(10);
  });

  it('returns identity update when only one slot', () => {
    const result = alignSlotsLeft([s1]);
    expect(result['a']?.x).toBe(10);
  });
});

describe('alignSlotsRight', () => {
  it('aligns all slot right edges to the rightmost right edge', () => {
    const result = alignSlotsRight([s1, s2, s3]);
    // maxRight = max(30, 50, 55) = 55
    expect(result['a']?.x).toBe(55 - 20); // 35
    expect(result['b']?.x).toBe(55 - 10); // 45
    expect(result['c']?.x).toBe(55 - 30); // 25
  });
});

describe('alignSlotsTop', () => {
  it('moves all slots to the topmost y', () => {
    const result = alignSlotsTop([s1, s2, s3]);
    expect(result['a']?.y).toBe(5);
    expect(result['b']?.y).toBe(5);
    expect(result['c']?.y).toBe(5);
  });
});

describe('alignSlotsBottom', () => {
  it('aligns all slot bottom edges to the lowest bottom edge', () => {
    const result = alignSlotsBottom([s1, s2, s3]);
    // maxBottom = max(20, 50, 20) = 50
    expect(result['a']?.y).toBe(50 - 15); // 35
    expect(result['b']?.y).toBe(50 - 30); // 20
    expect(result['c']?.y).toBe(50 - 10); // 40
  });
});

describe('centerSlotsHorizontally', () => {
  it('places slot centers at the midpoint of the bounding box', () => {
    const result = centerSlotsHorizontally([s1, s2, s3]);
    // minX=10, maxRight=55 → midX=32.5
    // a: x = 32.5 - 10 = 22.5
    // b: x = 32.5 - 5 = 27.5
    // c: x = 32.5 - 15 = 17.5
    expect(result['a']?.x).toBeCloseTo(22.5);
    expect(result['b']?.x).toBeCloseTo(27.5);
    expect(result['c']?.x).toBeCloseTo(17.5);
  });
});

describe('centerSlotsVertically', () => {
  it('places slot centers at the vertical midpoint of the bounding box', () => {
    const result = centerSlotsVertically([s1, s2, s3]);
    // minY=5, maxBottom=50 → midY=27.5
    // a: y = 27.5 - 7.5 = 20
    // b: y = 27.5 - 15 = 12.5
    // c: y = 27.5 - 5 = 22.5
    expect(result['a']?.y).toBeCloseTo(20);
    expect(result['b']?.y).toBeCloseTo(12.5);
    expect(result['c']?.y).toBeCloseTo(22.5);
  });
});

describe('distributeSlotsHorizontally', () => {
  it('falls back to alignSlotsLeft when fewer than 3 slots', () => {
    const result = distributeSlotsHorizontally([s1, s2]);
    expect(result['a']?.x).toBe(10); // leftmost
    expect(result['b']?.x).toBe(10);
  });

  it('evenly spaces 3 slots by center x', () => {
    const result = distributeSlotsHorizontally([s1, s2, s3]);
    // sort by cx: s1(cx=20), s3(cx=40), s2(cx=45)
    // span = cx(last)-cx(first) = 45-20 = 25, step = 25/2 = 12.5
    // s1: x = cx(first)+0*step - w/2 = 20 - 10 = 10
    // s3: x = 20+12.5 - 15 = 17.5
    // s2: x = 20+25 - 5 = 40
    expect(result['a']?.x).toBeCloseTo(10);
    expect(result['c']?.x).toBeCloseTo(17.5);
    expect(result['b']?.x).toBeCloseTo(40);
  });

  it('handles single slot via fallback', () => {
    const result = distributeSlotsHorizontally([s1]);
    expect(result['a']?.x).toBe(10);
  });
});

describe('distributeSlotsVertically', () => {
  it('falls back to alignSlotsTop when fewer than 3 slots', () => {
    const result = distributeSlotsVertically([s1, s2]);
    expect(result['a']?.y).toBe(5); // topmost
    expect(result['b']?.y).toBe(5);
  });

  it('evenly spaces 3 slots by center y', () => {
    const result = distributeSlotsVertically([s1, s2, s3]);
    // sort by cy: s1(cy=12.5), s3(cy=15), s2(cy=35)
    // span = 35-12.5 = 22.5, step = 22.5/2 = 11.25
    // s1: y = 12.5 + 0 - 7.5 = 5
    // s3: y = 12.5 + 11.25 - 5 = 18.75
    // s2: y = 12.5 + 22.5 - 15 = 20
    expect(result['a']?.y).toBeCloseTo(5);
    expect(result['c']?.y).toBeCloseTo(18.75);
    expect(result['b']?.y).toBeCloseTo(20);
  });
});

describe('distributeSlotsHorizontallyByGap', () => {
  it('falls back to alignSlotsLeft when fewer than 3 slots', () => {
    const result = distributeSlotsHorizontallyByGap([s1, s2]);
    expect(result['a']?.x).toBe(10);
    expect(result['b']?.x).toBe(10);
  });

  it('produces equal gaps between slot edges for 3 mixed-width slots', () => {
    // s1: x=10, w=20, right=30
    // s3: x=25, w=30, right=55
    // s2: x=40, w=10, right=50 → sorted by x: s1(10), s3(25), s2(40)
    // totalSpan = right(s2)=50 - x(s1)=10 = 40
    // totalSlotWidth = 20+30+10 = 60 — but 60 > 40, gap goes negative (overlap case)
    // Use slots without overlap: a(x=0,w=10), b(x=60,w=10), c(x=20,w=10)
    const a = makeSlot('a', 0, 0, 10, 10);
    const b = makeSlot('b', 60, 0, 10, 10);
    const c = makeSlot('c', 20, 0, 10, 10);
    // sorted by x: a(0), c(20), b(60)
    // totalSpan = right(b)=70 - x(a)=0 = 70
    // totalSlotWidth = 30
    // totalGap = 40, gap = 20
    // a: x=0, c: x=0+10+20=30, b: x=30+10+20=60
    const result = distributeSlotsHorizontallyByGap([a, b, c]);
    expect(result['a']?.x).toBeCloseTo(0);
    expect(result['c']?.x).toBeCloseTo(30);
    expect(result['b']?.x).toBeCloseTo(60);
  });

  it('anchors outermost slots and equalizes interior gaps', () => {
    const a = makeSlot('a', 0, 0, 5, 10);
    const b = makeSlot('b', 50, 0, 15, 10);
    const c = makeSlot('c', 30, 0, 10, 10);
    // sorted: a(0,w=5), c(30,w=10), b(50,w=15) → right(b)=65
    // totalSpan=65, totalSlotWidth=30, totalGap=35, gap=17.5
    // a: x=0, c: x=0+5+17.5=22.5, b: x=22.5+10+17.5=50
    const result = distributeSlotsHorizontallyByGap([a, b, c]);
    expect(result['a']?.x).toBeCloseTo(0);
    expect(result['c']?.x).toBeCloseTo(22.5);
    expect(result['b']?.x).toBeCloseTo(50);
    // Verify equal gaps: gap between a.right and c.left = 22.5-5=17.5; c.right to b.left = 50-32.5=17.5
    expect((result['c']?.x ?? 0) - ((result['a']?.x ?? 0) + 5)).toBeCloseTo(17.5);
    expect((result['b']?.x ?? 0) - ((result['c']?.x ?? 0) + 10)).toBeCloseTo(17.5);
  });
});

describe('distributeSlotsVerticallyByGap', () => {
  it('falls back to alignSlotsTop when fewer than 3 slots', () => {
    const result = distributeSlotsVerticallyByGap([s1, s2]);
    expect(result['a']?.y).toBe(5);
    expect(result['b']?.y).toBe(5);
  });

  it('produces equal gaps between slot edges for 3 mixed-height slots', () => {
    const a = makeSlot('a', 0, 0, 10, 5);
    const b = makeSlot('b', 0, 60, 10, 15);
    const c = makeSlot('c', 0, 20, 10, 10);
    // sorted by y: a(0,h=5), c(20,h=10), b(60,h=15) → bottom(b)=75
    // totalSpan=75, totalSlotHeight=30, totalGap=45, gap=22.5
    // a: y=0, c: y=0+5+22.5=27.5, b: y=27.5+10+22.5=60
    const result = distributeSlotsVerticallyByGap([a, b, c]);
    expect(result['a']?.y).toBeCloseTo(0);
    expect(result['c']?.y).toBeCloseTo(27.5);
    expect(result['b']?.y).toBeCloseTo(60);
    // Verify equal gaps
    expect((result['c']?.y ?? 0) - ((result['a']?.y ?? 0) + 5)).toBeCloseTo(22.5);
    expect((result['b']?.y ?? 0) - ((result['c']?.y ?? 0) + 10)).toBeCloseTo(22.5);
  });
});
