import { describe, expect, it } from 'vitest';

import { parseAutoColumnBreakpoints, resolveColumnsFromWidth } from './resolveColumnsFromWidth';

describe('resolveColumnsFromWidth', () => {
  it('falls back to the legacy width thresholds when no auto-breakpoint string is provided', () => {
    expect(resolveColumnsFromWidth(320, 0)).toBe(1);
    expect(resolveColumnsFromWidth(640, 0)).toBe(2);
    expect(resolveColumnsFromWidth(960, 0)).toBe(3);
    expect(resolveColumnsFromWidth(1200, 0)).toBe(4);
  });

  it('uses configured auto-breakpoint pairs when masonry is in auto mode', () => {
    const rules = '480:2,768:3,1024:4,1280:5';

    expect(resolveColumnsFromWidth(360, 0, rules)).toBe(1);
    expect(resolveColumnsFromWidth(500, 0, rules)).toBe(2);
    expect(resolveColumnsFromWidth(800, 0, rules)).toBe(3);
    expect(resolveColumnsFromWidth(1100, 0, rules)).toBe(4);
    expect(resolveColumnsFromWidth(1360, 0, rules)).toBe(5);
  });

  it('ignores malformed breakpoint pairs while parsing', () => {
    expect(parseAutoColumnBreakpoints('480:2, bad, 1024:4, 900:0')).toEqual([
      { width: 480, columns: 2 },
      { width: 1024, columns: 4 },
    ]);
  });

  it('returns fresh breakpoint data on every call so cache consumers cannot mutate shared state', () => {
    const first = parseAutoColumnBreakpoints('480:2,768:3');

    first.push({ width: 1440, columns: 6 });
    first[0].columns = 99;

    expect(parseAutoColumnBreakpoints('480:2,768:3')).toEqual([
      { width: 480, columns: 2 },
      { width: 768, columns: 3 },
    ]);
  });
});
