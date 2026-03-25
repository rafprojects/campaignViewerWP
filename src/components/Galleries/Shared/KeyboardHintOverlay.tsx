import { useCallback, useEffect, useState } from 'react';
import { Box, Group, Kbd, Text, Transition } from '@mantine/core';

const SESSION_KEY = 'wpsg-lightbox-hint-shown';
const DISMISS_DELAY = 3500;

interface KeyboardHintOverlayProps {
  /** Only show when the lightbox is open */
  visible: boolean;
}

/**
 * Displays a subtle keyboard-shortcut hint the first time the lightbox
 * is opened in a browser session. Auto-dismisses after a few seconds
 * or on any user interaction.
 */
export function KeyboardHintOverlay({ visible }: KeyboardHintOverlayProps) {
  const [show, setShow] = useState(false);

  const dismiss = useCallback(() => setShow(false), []);

  useEffect(() => {
    if (!visible) return;

    // Don't show keyboard hints on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    // Already shown this session
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // sessionStorage unavailable — skip hint
      return;
    }

    setShow(true);
    sessionStorage.setItem(SESSION_KEY, '1');

    const timer = setTimeout(dismiss, DISMISS_DELAY);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  // Dismiss on any keypress or pointer event while hint is showing
  useEffect(() => {
    if (!show) return;

    const handler = () => setShow(false);
    window.addEventListener('keydown', handler, { once: true });
    window.addEventListener('pointerdown', handler, { once: true });
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('pointerdown', handler);
    };
  }, [show]);

  return (
    <Transition mounted={show} transition="fade" duration={300}>
      {(transitionStyles) => (
        <Box
          pos="absolute"
          bottom={60}
          left="50%"
          style={{
            ...transitionStyles,
            transform: 'translateX(-50%)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <Box
            px="lg"
            py="sm"
            style={{
              background: 'color-mix(in srgb, var(--wpsg-color-background) 85%, transparent)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--mantine-radius-md)',
              border: '1px solid var(--wpsg-color-border)',
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              <Text size="sm" c="dimmed">navigate</Text>
              <Text size="sm" c="dimmed" mx={4}>·</Text>
              <Kbd>Esc</Kbd>
              <Text size="sm" c="dimmed">close</Text>
            </Group>
          </Box>
        </Box>
      )}
    </Transition>
  );
}
