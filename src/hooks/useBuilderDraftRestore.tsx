import { useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';
import i18n from '@/i18n';
import type { LayoutTemplate } from '@/types';
import type { LayoutDraftPayload } from '@/hooks/useLayoutBuilderState';

// [P71-E, extended P72-A] Notification copy routed through the shared i18next
// instance (outside JSX). P72-A brought the confirm-modal chrome (title, body,
// labels, and the relative age label) through the same binding — the ESLint gate
// now covers `modals.openConfirmModal` title/labels too.
const t = i18n.t.bind(i18n);

interface UseBuilderDraftRestoreOptions {
  opened: boolean;
  initialTemplate: LayoutTemplate | undefined;
  /** Called with the restored draft template. Typically: setTemplate + clearDraft. */
  onRestoreDraft: (template: LayoutTemplate) => void;
  /** Called when the user discards the draft. Typically: clearDraft. */
  onDiscardDraft: () => void;
}

/**
 * P36-A: On each open session, checks localStorage for a saved draft newer than the
 * server copy and prompts the user to restore or discard it.
 */
export function useBuilderDraftRestore({
  opened,
  initialTemplate,
  onRestoreDraft,
  onDiscardDraft,
}: UseBuilderDraftRestoreOptions): void {
  // Kept as refs so the effect always calls the latest version without re-running.
  const onRestoreDraftRef = useRef(onRestoreDraft);
  onRestoreDraftRef.current = onRestoreDraft;
  const onDiscardDraftRef = useRef(onDiscardDraft);
  onDiscardDraftRef.current = onDiscardDraft;

  const draftCheckedRef = useRef(false);

  useEffect(() => {
    if (!opened) {
      draftCheckedRef.current = false;
      return;
    }
    if (draftCheckedRef.current) return;

    const templateId = initialTemplate?.id;
    if (!templateId) return;

    draftCheckedRef.current = true;

    const stored = (() => {
      try { return localStorage.getItem(`wpsg_layout_draft_${templateId}`); } catch { return null; }
    })();
    if (!stored) return;

    let payload: LayoutDraftPayload | null = null;
    try {
      const parsed: unknown = JSON.parse(stored);
      // New payload format: must have savedAt + template fields
      if (
        parsed &&
        typeof parsed === 'object' &&
        'savedAt' in parsed &&
        'template' in parsed &&
        typeof (parsed as Record<string, unknown>).savedAt === 'number'
      ) {
        payload = parsed as LayoutDraftPayload;
      }
    } catch { return; }

    if (!payload) {
      // Old format (raw LayoutTemplate) — discard silently; can't determine age
      try { localStorage.removeItem(`wpsg_layout_draft_${templateId}`); } catch { /* ignore */ }
      return;
    }

    // The draft is valid if it was autosaved after the template was last server-saved.
    const serverSavedAt = initialTemplate?.updatedAt
      ? new Date(initialTemplate.updatedAt).getTime()
      : 0;
    if (payload.savedAt <= serverSavedAt) {
      // Draft predates the current server version — silently discard
      try { localStorage.removeItem(`wpsg_layout_draft_${templateId}`); } catch { /* ignore */ }
      return;
    }

    const isConflict = payload.serverUpdatedAt !== (initialTemplate?.updatedAt ?? '');
    const draftAge = Math.round((Date.now() - payload.savedAt) / 60_000);
    const ageLabel =
      draftAge < 1
        ? t('draftrestore_age_just_now', 'just now')
        : t('draftrestore_age_minutes', '{{count}} minute ago', { count: draftAge });

    const draftSnapshot = payload.template;
    modals.openConfirmModal({
      title: isConflict
        ? t('draftrestore_conflict_title', 'Draft conflict detected')
        : t('draftrestore_found_title', 'Unsaved draft found'),
      children: (
        <Text size="sm">
          {isConflict
            ? t(
                'draftrestore_conflict_body',
                'This template was saved in another session after your draft was created ({{age}}). Restoring your draft will overwrite those changes.',
                { age: ageLabel },
              )
            : t('draftrestore_found_body', 'An autosaved draft from {{age}} was found. Would you like to restore it?', {
                age: ageLabel,
              })}
        </Text>
      ),
      labels: { confirm: t('draftrestore_confirm', 'Restore draft'), cancel: t('draftrestore_discard', 'Discard') },
      confirmProps: { color: isConflict ? 'orange' : 'blue' },
      onConfirm: () => {
        onRestoreDraftRef.current(draftSnapshot);
        notifications.show({
          title: t('draft_restored_title', 'Draft restored'),
          message: t('draft_restored_message', 'Your previous session has been restored.'),
          color: 'blue',
          autoClose: 4000,
        });
      },
      onCancel: () => {
        onDiscardDraftRef.current();
        notifications.show({
          message: t('draft_discarded_message', 'Draft discarded.'),
          color: 'gray',
          autoClose: 3000,
        });
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, initialTemplate?.id]);
}
