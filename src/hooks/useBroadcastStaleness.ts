import { useCallback, useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import type { LayoutTemplate } from '@/types';

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
          title: 'Template updated in another tab',
          message: 'This template was saved elsewhere. Close and reopen to load the latest version.',
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
