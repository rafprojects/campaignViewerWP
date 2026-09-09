import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Group, Text, Transition } from '@mantine/core';

const SESSION_KEY = 'lightbox-hint-shown';
const DISMISS_DELAY = 3500;

// P77-D: literal colours on purpose. The lightbox portals to document.body,
// where under a shadow mount no `--mantine-*` variable is defined, so the
// previous `dimmed` text and `dark-7` panel resolved to nothing and the hint
// painted invisible (axe measured 1.24:1). The overlay behind it is always
// rgba(0,0,0,0.93), so these are theme-independent by construction.
const PANEL_STYLE: CSSProperties = {
  background: 'rgba(18, 18, 18, 0.88)',
  backdropFilter: 'blur(8px)',
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.18)',
};
const TEXT_STYLE: CSSProperties = { color: 'rgba(255, 255, 255, 0.82)' };
const KBD_STYLE: CSSProperties = {
  font: '600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#ffffff',
  background: 'rgba(255, 255, 255, 0.14)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderBottomWidth: 3,
  borderRadius: 4,
  padding: '1px 6px',
};

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
  const { t } = useTranslation('mullion');
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
          aria-hidden="true"
          style={{
            ...transitionStyles,
            transform: 'translateX(-50%)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <Box px="lg" py="sm" style={PANEL_STYLE}>
            <Group gap="xs" wrap="nowrap">
              <kbd style={KBD_STYLE}>{t('kb_arrow_left', '←')}</kbd>
              <kbd style={KBD_STYLE}>{t('kb_arrow_right', '→')}</kbd>
              <Text size="sm" style={TEXT_STYLE}>{t('kb_hint_navigate', 'navigate')}</Text>
              <Text size="sm" style={TEXT_STYLE} mx={4}>{t('kb_hint_separator', '·')}</Text>
              <kbd style={KBD_STYLE}>{t('kb_escape', 'Esc')}</kbd>
              <Text size="sm" style={TEXT_STYLE}>{t('kb_hint_close', 'close')}</Text>
            </Group>
          </Box>
        </Box>
      )}
    </Transition>
  );
}

KeyboardHintOverlay.displayName = 'KeyboardHintOverlay';
