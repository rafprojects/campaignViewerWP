import { useCallback, useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import i18n from '@/i18n';
import type { LayoutTemplate } from '@/types';

// [P71-E] Notification copy is user-facing but lives outside JSX, so route it
// through the shared i18next instance (the jsx-text-only lint rule can't see it).
const t = i18n.t.bind(i18n);

interface BuilderBroadcastMessage {
  type: 'template-saved';
  templateId: string;
}

const BUILDER_BC_CHANNEL = 'wpsg-layout-builder';

/**
 * P30-D: Opens a BroadcastChannel to detect when another tab saves the same template.
 * Returns `postSaved(templateId)` for the caller to fire after a successful save.
 */
export function useBroadcastStaleness(initialTemplate: LayoutTemplate | undefined): {
  postSaved: (templateId: string) => void;
} {
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(BUILDER_BC_CHANNEL);
    bcRef.current = channel;
    channel.onmessage = (event: MessageEvent<BuilderBroadcastMessage>) => {
      const data = event.data;
      if (
        data?.type === 'template-saved' &&
        data.templateId &&
        initialTemplate?.id &&
        data.templateId === initialTemplate.id
      ) {
        notifications.show({
          title: t('stale_tab_title', 'Template updated in another tab'),
          message: t('stale_tab_message', 'This template was saved elsewhere. Close and reopen to load the latest version.'),
          color: 'yellow',
          autoClose: 0,
        });
      }
    };
    return () => {
      channel.close();
      bcRef.current = null;
    };
  }, [initialTemplate?.id]);

  const postSaved = useCallback((templateId: string) => {
    try {
      bcRef.current?.postMessage({ type: 'template-saved', templateId } satisfies BuilderBroadcastMessage);
    } catch { /* BroadcastChannel may be unavailable in some environments */ }
  }, []);

  return { postSaved };
}
