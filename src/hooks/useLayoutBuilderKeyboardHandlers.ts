import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { buildGroupMap, collectDescendantSlotIds } from '@wp-super-gallery/shared-utils';
import i18n from '@/i18n';
import type { UseLayoutBuilderReturn } from './useLayoutBuilderState';

// [P72-A] Module-level binding so a11y announcements are localizable outside JSX.
const t = i18n.t.bind(i18n);

export function useLayoutBuilderKeyboardHandlers({
  opened,
  builder,
  announce,
  handleClose,
  handleDeleteSelected,
  handleDuplicateSelected,
  handleSave,
  setSelectedOverlayId,
  setIsBackgroundSelected,
  setBuilderShortcutsOpen,
}: {
  opened: boolean;
  builder: UseLayoutBuilderReturn;
  announce: (msg: string) => void;
  handleClose: () => void;
  handleDeleteSelected: () => void;
  handleDuplicateSelected: () => void;
  handleSave: () => Promise<boolean>;
  setSelectedOverlayId: Dispatch<SetStateAction<string | null>>;
  setIsBackgroundSelected: Dispatch<SetStateAction<boolean>>;
  setBuilderShortcutsOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when inside inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        builder.undo();
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        builder.redo();
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        handleDuplicateSelected();
        e.preventDefault();
      }
      // Clipboard (P58-A): copy/paste through an in-memory app clipboard.
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey && !builder.isPreview) {
        const n = builder.copySlots([...builder.selectedSlotIds]);
        if (n > 0) announce(t('lbkbd_copied', 'Copied {{count}} slot', { count: n }));
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey && !builder.isPreview) {
        const pastedIds = builder.pasteSlots();
        if (pastedIds.length > 0) {
          setSelectedOverlayId(null);
          setIsBackgroundSelected(false);
          announce(t('lbkbd_pasted', 'Pasted {{count}} slot', { count: pastedIds.length }));
        }
        e.preventDefault();
      }
      // Group / wrap-in-group / select-in-group (P30-G)
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) {
        const ids = [...builder.selectedSlotIds];
        const groups = builder.template.groups ?? [];
        const groupMap = buildGroupMap(groups);

        // P30-G: detect if selection is exactly one complete group's descendants
        const fullySelectedGroup = groups.find((g) => {
          const descIds = collectDescendantSlotIds(g.id, groupMap);
          return (
            descIds.length > 0 &&
            descIds.length === builder.selectedSlotIds.size &&
            descIds.every((id) => builder.selectedSlotIds.has(id))
          );
        });

        if (fullySelectedGroup) {
          // Wrap the full group in a new parent group
          const newId = builder.wrapInGroup([fullySelectedGroup.id]);
          builder.selectGroup(newId);
          announce(t('lbkbd_group_wrapped', 'Group wrapped in parent group'));
        } else {
          const touchedGroup = groups.find((g) =>
            g.memberIds.some((id) => builder.selectedSlotIds.has(id))
          );
          if (touchedGroup) {
            // Any selected slot belongs to a group — expand selection to all descendants.
            builder.selectGroup(touchedGroup.id);
            announce(t('lbkbd_group_selected', 'Group selected'));
          } else if (ids.length >= 2) {
            builder.createGroup(ids);
            announce(t('lb_mod_group_created', 'Group created ({{count}} slots)', { count: ids.length }));
          }
        }
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && e.shiftKey) {
        const groups = builder.template.groups ?? [];
        const selectedIds = builder.selectedSlotIds;
        if (groups.length > 0 && selectedIds.size > 0) {
          const shiftGGroupMap = buildGroupMap(groups);
          // P30-G fix: match by full descendant set, fall back to member overlap
          const targetGroup =
            groups.find((g) => {
              const descIds = collectDescendantSlotIds(g.id, shiftGGroupMap);
              return (
                descIds.length > 0 &&
                descIds.length === selectedIds.size &&
                descIds.every((id) => selectedIds.has(id))
              );
            }) ?? groups.find((g) => g.memberIds.some((id) => selectedIds.has(id)));
          if (targetGroup) {
            builder.dissolveGroup(targetGroup.id);
            announce(t('lb_mod_ungrouped', 'Ungrouped'));
          }
        }
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        if (builder.selectedSlotIds.size > 0) {
          // Something is selected — deselect and absorb the event so the
          // Modal's own Escape-to-close handler does not fire.
          builder.clearSelection();
          e.preventDefault();
          e.stopPropagation();
        } else {
          // Nothing selected — treat Escape as a modal close.
          handleClose();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }

      if (e.key === '?') {
        setBuilderShortcutsOpen(true);
      }

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !builder.isPreview) {
        const id = builder.addSlot();
        builder.selectSlot(id);
        setSelectedOverlayId(null);
        setIsBackgroundSelected(false);
        announce(t('lbkbd_new_slot', 'New slot added'));
        e.preventDefault();
      }

      // Z-index shortcuts (P15-G): ] = forward, [ = backward, Shift+] = front, Shift+[ = back
      const ids = Array.from(builder.selectedSlotIds);
      if (ids.length > 0) {
        if (e.key === ']' && e.shiftKey) {
          builder.bringToFront(ids);
          announce(t('lbkbd_brought_front', 'Brought to front'));
          e.preventDefault();
        } else if (e.key === ']') {
          builder.bringForward(ids);
          announce(t('lb_mod_ann_brought_forward', 'Brought forward'));
          e.preventDefault();
        } else if (e.key === '[' && e.shiftKey) {
          builder.sendToBack(ids);
          announce(t('lbkbd_sent_back', 'Sent to back'));
          e.preventDefault();
        } else if (e.key === '[') {
          builder.sendBackward(ids);
          announce(t('lb_mod_ann_sent_backward', 'Sent backward'));
          e.preventDefault();
        }
      }

      // Arrow keys: nudge selected slots.
      // P58-A: Alt = fine (0.1%), Shift = large (10%), plain = 1% (Figma/Sketch convention).
      const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
      if (ids.length > 0) {
        if (e.key === 'ArrowLeft') {
          builder.nudgeSlots(ids, -step, 0);
          e.preventDefault();
        }
        if (e.key === 'ArrowRight') {
          builder.nudgeSlots(ids, step, 0);
          e.preventDefault();
        }
        if (e.key === 'ArrowUp') {
          builder.nudgeSlots(ids, 0, -step);
          e.preventDefault();
        }
        if (e.key === 'ArrowDown') {
          builder.nudgeSlots(ids, 0, step);
          e.preventDefault();
        }
      }
    },
    [announce, builder, handleClose, handleDeleteSelected, handleDuplicateSelected, handleSave, setSelectedOverlayId, setIsBackgroundSelected, setBuilderShortcutsOpen],
  );

  // Attach/detach the document-level listener whenever the modal opens/closes.
  useEffect(() => {
    if (!opened) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [opened, handleKeyDown]);
}
