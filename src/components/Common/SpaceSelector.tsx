import { Select } from '@mantine/core';
import type { CSSProperties } from 'react';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export type SpaceSelectItem = { value: string; label: string };

interface SpaceSelectorProps {
  data: SpaceSelectItem[];
  value: string;
  onChange: (value: string) => void;
  size?: string;
  w?: number;
  style?: CSSProperties;
  'aria-label'?: string;
  disabled?: boolean;
}

export function SpaceSelector({
  data,
  value,
  onChange,
  size = 'sm',
  w,
  style,
  'aria-label': ariaLabel = 'Active space',
  disabled,
}: SpaceSelectorProps) {
  return (
    <Select
      data={data}
      value={value}
      onChange={(v) => onChange(v ?? 'all')}
      size={size}
      w={w}
      style={style}
      aria-label={ariaLabel}
      disabled={disabled ?? false}
      allowDeselect={false}
    />
  );
}

setWpsgDebugDisplayName(SpaceSelector, 'SpaceSelector');
