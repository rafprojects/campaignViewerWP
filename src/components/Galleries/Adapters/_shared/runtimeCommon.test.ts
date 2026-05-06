import { describe, expect, it } from 'vitest';

import { resolveAdapterShellStyle } from './runtimeCommon';

describe('resolveAdapterShellStyle', () => {
  it('fills the available section width in fill mode', () => {
    expect(resolveAdapterShellStyle({ adapterSizingMode: 'fill' })).toEqual({
      width: '100%',
    });
  });

  it('fills available width while respecting manual max width', () => {
    expect(resolveAdapterShellStyle({ adapterSizingMode: 'manual', adapterMaxWidthPct: 82 })).toEqual({
      width: '100%',
      maxWidth: '82%',
      marginInline: 'auto',
    });
  });

  it('defaults manual mode to 100 percent max width when unset', () => {
    expect(resolveAdapterShellStyle({ adapterSizingMode: 'manual' })).toEqual({
      width: '100%',
      maxWidth: '100%',
      marginInline: 'auto',
    });
  });
});