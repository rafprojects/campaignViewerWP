import { useState, useCallback, useRef } from 'react';
import { ActionIcon, Popover, Stack, Text, Button, Divider, Group } from '@mantine/core';
import { IconUser, IconSettings, IconLogout, IconDashboard, IconGripVertical } from '@tabler/icons-react';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const STORAGE_KEY = 'wpsg-authbar-pos';
const ICON_SIZE = 40;

interface AuthBarFloatingProps {
  email: string;
  isAdmin: boolean;
  draggable?: boolean;
  dragMargin?: number;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

function readSavedPos(): { x: number; y: number } | null {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'x' in parsed && 'y' in parsed) {
      const p = parsed as { x: number; y: number };
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch { /* ignore */ }
  return null;
}

export function AuthBarFloating({
  email,
  isAdmin,
  draggable = false,
  dragMargin = 16,
  onOpenAdminPanel,
  onOpenSettings,
  onLogout,
}: AuthBarFloatingProps) {
  const margin = dragMargin;

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (!draggable) return { x: 0, y: 0 }; // ignored for non-draggable
    const saved = readSavedPos();
    return saved ?? {
      x: Math.max(margin, (typeof window !== 'undefined' ? window.innerWidth : 800) - ICON_SIZE - margin),
      y: Math.max(margin, (typeof window !== 'undefined' ? window.innerHeight : 600) - ICON_SIZE - margin),
    };
  });

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(margin, Math.min((typeof window !== 'undefined' ? window.innerWidth : 800) - ICON_SIZE - margin, x)),
      y: Math.max(margin, Math.min((typeof window !== 'undefined' ? window.innerHeight : 600) - ICON_SIZE - margin, y)),
    }),
    [margin],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!draggable) return;
      setDragging(true);
      didDragRef.current = false;
      dragStartRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [draggable, pos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      didDragRef.current = true;
      const next = clamp(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
      requestAnimationFrame(() => setPos(next));
    },
    [dragging, clamp],
  );

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    if (!didDragRef.current) setPopoverOpen((o) => !o);
  }, [dragging, pos]);

  const handleClick = draggable
    ? undefined
    : () => setPopoverOpen((o) => !o);

  const buttonStyle: React.CSSProperties = draggable
    ? {
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }
    : {
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
      };

  return (
    <Popover opened={popoverOpen} onChange={setPopoverOpen} position="top-end" withArrow shadow="md" width={220}>
      <Popover.Target>
        <ActionIcon
          size={ICON_SIZE}
          radius="xl"
          variant="filled"
          aria-label="User menu"
          style={buttonStyle}
          onClick={handleClick}
          onPointerDown={draggable ? onPointerDown : undefined}
          onPointerMove={draggable ? onPointerMove : undefined}
          onPointerUp={draggable ? onPointerUp : undefined}
        >
          {draggable ? <IconGripVertical size={20} /> : <IconUser size={20} />}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="xs" c="dimmed" truncate>Signed in as {email}</Text>
          <Divider />
          {isAdmin && (
            <>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconDashboard size={14} />}
                justify="start"
                onClick={() => { onOpenAdminPanel(); setPopoverOpen(false); }}
              >
                Admin Panel
              </Button>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconSettings size={14} />}
                justify="start"
                onClick={() => { onOpenSettings(); setPopoverOpen(false); }}
              >
                Settings
              </Button>
              <Divider />
            </>
          )}
          <Group justify="center">
            <Button
              variant="subtle"
              size="xs"
              color="red"
              leftSection={<IconLogout size={14} />}
              onClick={onLogout}
            >
              Sign out
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
