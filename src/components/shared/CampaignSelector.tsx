import { Select, Text } from '@mantine/core';
import type { CSSProperties } from 'react';

export type CampaignSelectItem = { value: string; label: string };

interface CampaignSelectorProps {
  label?: string;
  placeholder?: string;
  data: CampaignSelectItem[];
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  style?: CSSProperties;
  'aria-label'?: string;
}

export function CampaignSelector({
  label = 'Campaign',
  placeholder = 'Select campaign',
  data,
  value,
  onChange,
  clearable = false,
  style,
  'aria-label': ariaLabel,
}: CampaignSelectorProps) {
  return (
    <Select
      label={<Text size="sm" fw={500} c="gray.2">{label}</Text>}
      placeholder={placeholder}
      data={data}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      clearable={clearable}
      style={style}
      aria-label={ariaLabel}
    />
  );
}
