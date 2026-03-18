import type { ReactNode } from 'react';
import { Tooltip, ActionIcon, Group } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

interface SettingTooltipProps {
  label: ReactNode;
  tooltip: string;
  enabled: boolean;
}

export function SettingTooltip({ label, tooltip, enabled }: SettingTooltipProps) {
  if (!enabled) return <>{label}</>;
  return (
    <Group gap={4} component="span" wrap="nowrap" style={{ display: 'inline-flex' }}>
      {label}
      <Tooltip label={tooltip} multiline w={280} withArrow position="top">
        <ActionIcon variant="transparent" size="xs" aria-label={tooltip} tabIndex={0}>
          <IconInfoCircle size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
