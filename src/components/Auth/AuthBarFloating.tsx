import { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { ActionIcon, Popover, Stack, Text, Button, Divider, Group } from '@mantine/core';
import { IconMenu2, IconSettings, IconLogout, IconDashboard, IconGripVertical, IconLogin, IconEdit, IconPhoto, IconArchive, IconAdjustments } from '@tabler/icons-react';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useCampaignContext } from '@/contexts/CampaignContext';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

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

interface AuthBarFloatingTriggerProps extends React.ComponentPropsWithoutRef<'button'> {
  draggable: boolean;
  buttonStyle: React.CSSProperties;
}

const AuthBarFloatingTrigger = forwardRef<HTMLButtonElement, AuthBarFloatingTriggerProps>(
  ({
    draggable,
    buttonStyle,
    style,
    children,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    ...actionIconProps
  }, ref) => (
    <ActionIcon
      {...getWpsgDebugProps('AuthBarFloating', 'trigger')}
      {...actionIconProps}
      ref={ref}
      size={ICON_SIZE}
      radius="xl"
      variant="filled"
      aria-label="Admin menu"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        ...buttonStyle,
        ...style,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.3)',
      }}
    >
      {children ?? (draggable ? <IconGripVertical size={22} /> : <IconMenu2 size={22} />)}
    </ActionIcon>
  ),
);

setWpsgDebugDisplayName(AuthBarFloatingTrigger, 'AuthBarFloatingTrigger');

function scheduleCloseMenu(closeMenu: () => void) {
  requestAnimationFrame(() => closeMenu());
}

interface AuthBarFloatingMenuContentProps {
  email: string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  activeCampaign: ReturnType<typeof useCampaignContext>['activeCampaign'];
  onEditCampaign: ReturnType<typeof useCampaignContext>['onEditCampaign'];
  onEditGalleryConfig: ReturnType<typeof useCampaignContext>['onEditGalleryConfig'];
  onArchiveCampaign: ReturnType<typeof useCampaignContext>['onArchiveCampaign'];
  onAddExternalMedia: ReturnType<typeof useCampaignContext>['onAddExternalMedia'];
  closeMenu: () => void;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onOpenSignIn?: () => void;
  onLogout: () => void;
}

function AuthBarFloatingMenuContent({
  email,
  isAdmin,
  isAuthenticated,
  activeCampaign,
  onEditCampaign,
  onEditGalleryConfig,
  onArchiveCampaign,
  onAddExternalMedia,
  closeMenu,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSignIn,
  onLogout,
}: AuthBarFloatingMenuContentProps) {
  return (
    <Stack {...getWpsgDebugProps('AuthBarFloating', 'menu')} gap="xs">
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
                onClick={() => { onOpenAdminPanel(); scheduleCloseMenu(closeMenu); }}
              >
                Admin Panel
              </Button>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconSettings size={14} />}
                justify="start"
                onClick={() => { onOpenSettings(); scheduleCloseMenu(closeMenu); }}
              >
                Settings
              </Button>
              {activeCampaign && (
                <>
                  <Divider label="Campaign" labelPosition="center" />
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconEdit size={14} />}
                    justify="start"
                    onClick={() => { onEditCampaign?.(activeCampaign); scheduleCloseMenu(closeMenu); }}
                    aria-label={`Edit ${activeCampaign.title}`}
                  >
                    Edit Campaign
                  </Button>
                  {onEditGalleryConfig && (
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconAdjustments size={14} />}
                      justify="start"
                      onClick={() => { onEditGalleryConfig(activeCampaign); scheduleCloseMenu(closeMenu); }}
                      aria-label={`Edit gallery config for ${activeCampaign.title}`}
                    >
                      Edit Gallery Config
                    </Button>
                  )}
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconPhoto size={14} />}
                    justify="start"
                    onClick={() => { onAddExternalMedia?.(activeCampaign); scheduleCloseMenu(closeMenu); }}
                    aria-label={`Manage media for ${activeCampaign.title}`}
                  >
                    Manage Media
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="red"
                    leftSection={<IconArchive size={14} />}
                    justify="start"
                    onClick={() => { onArchiveCampaign?.(activeCampaign); scheduleCloseMenu(closeMenu); }}
                    aria-label={`Archive ${activeCampaign.title}`}
                  >
                    Archive
                  </Button>
                </>
              )}
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
            onClick={() => { onOpenSignIn?.(); scheduleCloseMenu(closeMenu); }}
          >
            Sign in
          </Button>
        </>
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(AuthBarFloatingMenuContent, 'AuthBarFloatingMenuContent');

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
  const { activeCampaign, onEditCampaign, onEditGalleryConfig, onArchiveCampaign, onAddExternalMedia } = useCampaignContext();

  // Read saved position (works in SSR — just returns null)
  const saved = readSavedPos();

  // Start with saved position or null (default computed in useEffect after mount)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(
    !draggable ? { x: 0, y: 0 } : saved,
  );

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const posRef = useRef(pos); // always-current position for save

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(margin, Math.min(window.innerWidth - ICON_SIZE - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - ICON_SIZE - margin, y)),
    }),
    [margin],
  );

  // Compute default position in browser after mount (reliable window dimensions)
  useEffect(() => {
    if (!draggable || pos !== null) return;
    const defaultPos = {
      x: Math.max(margin, window.innerWidth - ICON_SIZE - margin),
      y: Math.max(margin, window.innerHeight - ICON_SIZE - margin),
    };
    setPos(defaultPos);
    posRef.current = defaultPos;
    // Save immediately so next load reads a valid position
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPos));
  }, [draggable, margin, pos]);

  // Re-clamp position on window resize (prevent icon going off-screen)
  useEffect(() => {
    if (!draggable) return;
    const handleResize = () => {
      setPos((prev) => {
        if (!prev) return prev;
        const clamped = clamp(prev.x, prev.y);
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          posRef.current = clamped;
          safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
          return clamped;
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draggable, clamp]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!draggable || !posRef.current) return;
      setDragging(true);
      didDragRef.current = false;
      dragStartRef.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [draggable],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      didDragRef.current = true;
      const next = clamp(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
      posRef.current = next;
      requestAnimationFrame(() => setPos(next));
    },
    [dragging, clamp],
  );

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current));
    if (!didDragRef.current) setPopoverOpen((o) => !o);
  }, [dragging]);

  const handleClick = draggable
    ? undefined
    : () => setPopoverOpen((o) => !o);

  const buttonStyle: React.CSSProperties = draggable
    ? {
      position: 'fixed',
      left: pos?.x ?? 0,
      top: pos?.y ?? 0,
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

  // Don't render until position is computed (prevents flash at wrong location)
  if (draggable && pos === null) return null;

  return (
    <Popover {...getWpsgDebugProps('AuthBarFloating')} opened={popoverOpen} onChange={setPopoverOpen} withinPortal={false} position="top-end" withArrow shadow="md" width={220}
      styles={{ dropdown: { backdropFilter: 'blur(8px)' } }}
    >
      <Popover.Target>
        <AuthBarFloatingTrigger
          draggable={draggable}
          buttonStyle={buttonStyle}
          onClick={handleClick}
          onPointerDown={draggable ? onPointerDown : undefined}
          onPointerMove={draggable ? onPointerMove : undefined}
          onPointerUp={draggable ? onPointerUp : undefined}
        />
      </Popover.Target>
      <Popover.Dropdown {...getWpsgDebugProps('AuthBarFloating', 'dropdown')}>
        <AuthBarFloatingMenuContent
          email={email}
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
          activeCampaign={activeCampaign}
          onEditCampaign={onEditCampaign}
          onEditGalleryConfig={onEditGalleryConfig}
          onArchiveCampaign={onArchiveCampaign}
          onAddExternalMedia={onAddExternalMedia}
          closeMenu={() => setPopoverOpen(false)}
          onOpenAdminPanel={onOpenAdminPanel}
          onOpenSettings={onOpenSettings}
          onOpenSignIn={onOpenSignIn}
          onLogout={onLogout}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

setWpsgDebugDisplayName(AuthBarFloating, 'AuthBarFloating');