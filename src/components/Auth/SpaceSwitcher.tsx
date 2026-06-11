import { Badge, Menu, Text } from '@mantine/core';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { usePageSpaces } from '@/hooks/usePageSpaces';
import { spaceColor } from '@/utils/spaceColor';

interface SpaceSwitcherProps {
  /** The currently targeted space. */
  activeInstanceId: string;
  /** Called when the user picks a different space. */
  onSelect: (instanceId: string) => void;
}

/** Space-context badge shown in all AuthBar variants.
 *  Single-space: non-interactive colored label.
 *  Multi-space: dropdown to switch which space the Admin Panel/Settings buttons target. */
export function SpaceSwitcher({ activeInstanceId, onSelect }: SpaceSwitcherProps) {
  const pageSpaces = usePageSpaces();
  const active = pageSpaces.find((s) => s.instanceId === activeInstanceId);
  const label = active?.name ?? activeInstanceId;
  const color = spaceColor(activeInstanceId);
  const isMultiSpace = pageSpaces.length > 1;

  const badge = (
    <Badge
      variant="light"
      color={color}
      size="sm"
      rightSection={isMultiSpace ? <IconChevronDown size={10} /> : undefined}
      style={{ cursor: isMultiSpace ? 'pointer' : 'default', userSelect: 'none' }}
      aria-label={isMultiSpace ? 'Switch targeted gallery space' : label}
    >
      {label}
    </Badge>
  );

  if (!isMultiSpace) return badge;

  return (
    <Menu shadow="md" position="bottom-start" withArrow withinPortal={false}>
      <Menu.Target>{badge}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="xs" c="dimmed">Target space</Text>
        </Menu.Label>
        {pageSpaces.map((space) => {
          const isActive = space.instanceId === activeInstanceId;
          return (
            <Menu.Item
              key={space.instanceId}
              fw={isActive ? 600 : undefined}
              leftSection={isActive ? <IconCheck size={12} /> : <span style={{ width: 12, display: 'inline-block' }} />}
              onClick={() => onSelect(space.instanceId)}
            >
              {space.name}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
