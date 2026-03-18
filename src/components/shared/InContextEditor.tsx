import { useCallback, type ReactNode } from 'react';
import { ActionIcon, Popover, ScrollArea, Box } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

interface InContextEditorProps {
  /** Position relative to the nearest positioned parent. */
  position?: 'top-right' | 'top-left' | 'bottom-right';
  /** Only show when true (typically isAdmin && showInContextEditors). */
  visible?: boolean;
  /** Popup content — form fields for the relevant settings. */
  children: ReactNode;
}

const positionStyles: Record<string, React.CSSProperties> = {
  'top-right': { position: 'absolute', top: 8, right: 8, zIndex: 10 },
  'top-left': { position: 'absolute', top: 8, left: 8, zIndex: 10 },
  'bottom-right': { position: 'absolute', bottom: 8, right: 8, zIndex: 10 },
};

/**
 * Admin-only floating gear icon that opens a popover for live editing of
 * nearby settings.  Rendered inside gallery/card/viewer components; only
 * visible when `visible` is true.
 */
export function InContextEditor({
  position = 'top-right',
  visible = false,
  children,
}: InContextEditorProps) {
  const [opened, { toggle, close }] = useDisclosure(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { close(); e.stopPropagation(); }
    },
    [close],
  );

  if (!visible) return null;

  return (
    <Box style={positionStyles[position]} onKeyDown={handleKeyDown}>
      <Popover
        opened={opened}
        onClose={close}
        position="bottom-end"
        shadow="lg"
        width={340}
        withArrow
        closeOnClickOutside
        closeOnEscape
        styles={{ dropdown: { backgroundColor: 'rgba(30, 30, 40, 0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#e0e0e6' } }}
      >
        <Popover.Target>
          <ActionIcon
            variant="filled"
            color="blue"
            size="sm"
            radius="xl"
            onClick={toggle}
            title="Edit settings"
            style={{ opacity: 0.85 }}
          >
            <IconSettings size={14} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <ScrollArea.Autosize mah={400}>
            {children}
          </ScrollArea.Autosize>
        </Popover.Dropdown>
      </Popover>
    </Box>
  );
}
