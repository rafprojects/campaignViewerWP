import { useState, useCallback, useRef } from 'react';
import { ActionIcon, Popover, Stack, Text, Button, Divider, Group } from '@mantine/core';
import { IconMenu2, IconSettings, IconLogout, IconDashboard, IconGripVertical, IconLogin } from '@tabler/icons-react';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const STORAGE_KEY = 'wpsg-authbar-pos';
const ICON_SIZE = 44;

interface AuthBarFloatingProps {
  email: string;
  isAdmin: boolean;
  isAuthenticated?: boolean;
  draggable?: boolean;
  dragMargin?: number;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onOpenSignIn?: () => void;
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
  isAuthenticated = true,
  draggable = false,
  dragMargin = 16,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSignIn,
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
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
        right: 24,
        bottom: 24,
        zIndex: 9999,
      };

  return (
    <Popover opened={popoverOpen} onChange={setPopoverOpen} position="top-end" withArrow shadow="md" width={220}
      styles={{ dropdown: { backgroundColor: 'rgba(30, 30, 40, 0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#e0e0e6' } }}
    >
      <Popover.Target>
        <ActionIcon
          size={ICON_SIZE}
          radius="xl"
          variant="filled"
          aria-label="Admin menu"
          style={{
            ...buttonStyle,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.3)',
          }}
          onClick={handleClick}
          onPointerDown={draggable ? onPointerDown : undefined}
          onPointerMove={draggable ? onPointerMove : undefined}
          onPointerUp={draggable ? onPointerUp : undefined}
        >
          {draggable ? <IconGripVertical size={22} /> : <IconMenu2 size={22} />}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          {isAuthenticated ? (
            <>
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
            </>
          ) : (
            <>
              <Text size="xs" c="dimmed">Sign in to access private campaigns.</Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconLogin size={14} />}
                onClick={() => { onOpenSignIn?.(); setPopoverOpen(false); }}
              >
                Sign in
              </Button>
            </>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
