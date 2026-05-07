import { forwardRef, useCallback, type ReactNode } from 'react';
import { ActionIcon, Popover, ScrollArea, Box } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface InContextEditorProps {
  /** Position relative to the nearest positioned parent. */
  position?: 'top-right' | 'top-left' | 'bottom-right';
  /** Only show when true (typically isAdmin && showInContextEditors). */
  visible?: boolean;
  /** Popup content — form fields for the relevant settings. */
  children: ReactNode;
}

interface InContextEditorToggleProps extends React.ComponentPropsWithoutRef<'button'> {
  onToggle: () => void;
}

const InContextEditorToggle = forwardRef<HTMLButtonElement, InContextEditorToggleProps>(
  ({ onToggle, style, children, onClick, ...actionIconProps }, ref) => {
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        onToggle();
      }
    };

    return (
      <ActionIcon
        {...getWpsgDebugProps('InContextEditor', 'toggle')}
        {...actionIconProps}
        ref={ref}
        variant="filled"
        color="blue"
        size="sm"
        radius="xl"
        onClick={handleClick}
        title="Edit settings"
        style={{ opacity: 0.85, ...style }}
      >
        {children ?? <IconSettings size={14} />}
      </ActionIcon>
    );
  },
);

setWpsgDebugDisplayName(InContextEditorToggle, 'InContextEditorToggle');

interface InContextEditorContentProps {
  children: ReactNode;
}

function InContextEditorContent({ children }: InContextEditorContentProps) {
  return (
    <Popover.Dropdown {...getWpsgDebugProps('InContextEditor', 'dropdown')}>
      <ScrollArea.Autosize {...getWpsgDebugProps('InContextEditor', 'content')} mah={400}>
        {children}
      </ScrollArea.Autosize>
    </Popover.Dropdown>
  );
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
    <Box {...getWpsgDebugProps('InContextEditor', 'anchor')} style={positionStyles[position]} onKeyDown={handleKeyDown}>
      <Popover
        {...getWpsgDebugProps('InContextEditor')}
        opened={opened}
        onClose={close}
        position="bottom-end"
        shadow="lg"
        width={340}
        withArrow
        closeOnClickOutside
        closeOnEscape
        styles={{ dropdown: { backdropFilter: 'blur(8px)' } }}
      >
        <Popover.Target>
          <InContextEditorToggle onToggle={toggle} />
        </Popover.Target>
        <InContextEditorContent>{children}</InContextEditorContent>
      </Popover>
    </Box>
  );
}

setWpsgDebugDisplayName(InContextEditor, 'InContextEditor');