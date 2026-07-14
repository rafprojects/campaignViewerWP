import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, Tooltip, ActionIcon, Divider, TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import {
  IconPlus, IconTrash, IconCopy, IconMask, IconLetterT,
  IconAlignBoxLeftMiddle, IconAlignBoxCenterMiddle, IconAlignBoxRightMiddle,
  IconAlignBoxTopCenter, IconAlignBoxBottomCenter,
  IconLayoutDistributeHorizontal, IconLayoutDistributeVertical,
  IconLayoutDistributeHorizontalFilled, IconLayoutDistributeVerticalFilled,
  IconAlignBoxCenterTop,
} from '@tabler/icons-react';
import {
  alignSlotsLeft, alignSlotsRight, alignSlotsTop, alignSlotsBottom,
  centerSlotsHorizontally, centerSlotsVertically,
  distributeSlotsHorizontally, distributeSlotsVertically,
  distributeSlotsHorizontallyByGap, distributeSlotsVerticallyByGap,
} from '@wp-super-gallery/shared-utils';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayerPanel } from './LayerPanel';
import { DEFAULT_MASK_LAYER } from '@/types';
import { buildLayerList } from '@/utils/layerList';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { useRootId } from '@wp-super-gallery/shared-ui';
import { useWpsgLicense } from '@/hooks/useWpsgLicense';
import { showProUpsell } from '@/utils/wpsgUpsell';

export function LayoutBuilderLayersPanel(_props: IDockviewPanelProps) {
  const { t: tr } = useTranslation('wpsg');
  const { isPro, upgradeUrl } = useWpsgLicense();
  const [filterQuery, setFilterQuery] = useState('');

  const {
    builder,
    selectedOverlayId,
    setSelectedOverlayId,
    isBackgroundSelected,
    setIsBackgroundSelected,
    selectedMaskSlotId,
    setSelectedMaskSlotId,
    selectedTextId,
    setSelectedTextId,
    setSelectedGuideId,
    designAssetsOpen: _designAssetsOpen,
    setDesignAssetsOpen,
    bgSectionRef,
    dockApiRef,
    handleDeleteSelected,
    handleDuplicateSelected,
  } = useBuilderDock();
  const rootId = useRootId();

  /** Delete a single layer by ID (slot, overlay, or mask). */
  const handleDeleteLayer = useCallback(
    (id: string, kind: 'slot' | 'graphic' | 'text' | 'mask') => {
      if (kind === 'graphic') {
        builder.removeOverlay(id);
      } else if (kind === 'text') {
        builder.removeText(id);
        if (selectedTextId === id) setSelectedTextId(null);
      } else if (kind === 'mask') {
        // id is the parent slot id for mask deletions
        builder.updateSlot(id, { maskLayer: undefined, maskUrl: undefined, maskMode: undefined });
        if (selectedMaskSlotId === id) setSelectedMaskSlotId(null);
      } else {
        builder.removeSlots([id]);
      }
    },
    [builder, selectedMaskSlotId, setSelectedMaskSlotId, selectedTextId, setSelectedTextId],
  );

  /** Toggle mask visibility for a given slot. */
  const handleToggleMaskVisible = useCallback(
    (parentSlotId: string) => {
      const slot = builder.template.slots.find((s) => s.id === parentSlotId);
      if (!slot?.maskLayer) return;
      const current = slot.maskLayer.visible !== false;
      builder.updateSlot(parentSlotId, {
        maskLayer: { ...slot.maskLayer, visible: !current },
      });
    },
    [builder],
  );

  // Derive the currently-selected single slot (if any)
  const singleSelectedSlotId =
    builder.selectedSlotIds.size === 1 ? [...builder.selectedSlotIds][0] : null;
  const singleSelectedSlot = singleSelectedSlotId
    ? builder.template.slots.find((s) => s.id === singleSelectedSlotId)
    : null;
  const canAddMask =
    !!singleSelectedSlot && !singleSelectedSlot.maskLayer && !singleSelectedSlot.maskUrl;

  /** Add an empty mask sublayer to the selected slot (no file picker). */
  const handleAddMask = useCallback(() => {
    if (!singleSelectedSlot) return;
    builder.updateSlot(singleSelectedSlot.id, {
      maskLayer: { ...DEFAULT_MASK_LAYER, url: '' },
    });
    // Auto-select the new mask sublayer so properties panel opens
    setSelectedMaskSlotId(singleSelectedSlot.id);
  }, [singleSelectedSlot, builder, setSelectedMaskSlotId]);

  // Resolve the selected slots for alignment operations
  const selectedSlots = builder.template.slots.filter((s) =>
    builder.selectedSlotIds.has(s.id)
  );

  const applyAlignment = useCallback(
    (updates: Record<string, Partial<import('@/types').LayoutSlot>>) => {
      builder.updateSlots(updates, tr('lb_layers_align_slots', 'Align slots'));
    },
    [builder, tr],
  );

  // Group-aware alignment: groups where ALL members are selected move as a unit.
  // A virtual LayoutSlot is created for each such group using its computed bounding
  // box; free (ungrouped) selected slots are passed through unchanged. After
  // alignment, the delta of each virtual slot is applied to all its member slots.
  const applyAlignmentGroupAware = useCallback(
    (fn: (slots: import('@/types').LayoutSlot[]) => Record<string, Partial<import('@/types').LayoutSlot>>) => {
      const groups = builder.template.groups ?? [];
      const fullySelectedGroups = groups.filter(
        (g) => g.memberIds.length > 0 && g.memberIds.every((id) => builder.selectedSlotIds.has(id)),
      );

      if (fullySelectedGroups.length === 0) {
        applyAlignment(fn(selectedSlots));
        return;
      }

      const groupMemberIds = new Set(fullySelectedGroups.flatMap((g) => g.memberIds));
      const freeSlots = selectedSlots.filter((s) => !groupMemberIds.has(s.id));

      const virtualSlots: import('@/types').LayoutSlot[] = fullySelectedGroups.map((g) => {
        const members = builder.template.slots.filter((s) => g.memberIds.includes(s.id));
        const minX = Math.min(...members.map((s) => s.x));
        const minY = Math.min(...members.map((s) => s.y));
        const maxRight = Math.max(...members.map((s) => s.x + s.width));
        const maxBottom = Math.max(...members.map((s) => s.y + s.height));
        return {
          ...members[0]!,
          id: `__group__${g.id}`,
          x: minX, y: minY,
          width: maxRight - minX,
          height: maxBottom - minY,
        };
      });

      const rawUpdates = fn([...freeSlots, ...virtualSlots]);
      const finalUpdates: Record<string, Partial<import('@/types').LayoutSlot>> = {};

      for (const s of freeSlots) {
        if (rawUpdates[s.id]) finalUpdates[s.id] = rawUpdates[s.id]!;
      }

      for (const vSlot of virtualSlots) {
        const update = rawUpdates[vSlot.id];
        if (!update) continue;
        const dx = (update.x ?? vSlot.x) - vSlot.x;
        const dy = (update.y ?? vSlot.y) - vSlot.y;
        const groupId = vSlot.id.slice('__group__'.length);
        const group = fullySelectedGroups.find((g) => g.id === groupId)!;
        for (const memberId of group.memberIds) {
          const member = builder.template.slots.find((s) => s.id === memberId);
          if (member) {
            finalUpdates[memberId] = {
              ...(dx !== 0 ? { x: member.x + dx } : {}),
              ...(dy !== 0 ? { y: member.y + dy } : {}),
            };
          }
        }
      }

      builder.updateSlots(finalUpdates, tr('lb_layers_align_slots', 'Align slots'));
    },
    [builder, selectedSlots, applyAlignment, tr],
  );

  /** Add an empty mask sublayer to an arbitrary slot by ID — used from the layer row context menu. */
  const handleAddMaskForSlot = useCallback(
    (slotId: string) => {
      const slot = builder.template.slots.find((s) => s.id === slotId);
      if (!slot || slot.maskLayer || slot.maskUrl) return;
      builder.updateSlot(slotId, {
        maskLayer: { ...DEFAULT_MASK_LAYER, url: '' },
      });
      setSelectedMaskSlotId(slotId);
    },
    [builder, setSelectedMaskSlotId],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--wpsg-builder-surface)',
        color: 'var(--wpsg-builder-text)',
      }}
    >
      {/* Slot toolbar */}
      {!builder.isPreview && (
        <Group
          gap={4}
          px={6}
          py={4}
          style={{
            borderBottom: '1px solid var(--wpsg-builder-border)',
            flexShrink: 0,
          }}
        >
          <Tooltip label={tr('lb_layers_add_slot', 'Add slot')}>
            <ActionIcon
              size="sm"
              variant="light"
              onClick={() => builder.addSlot()}
              aria-label={tr('lb_layers_add_slot', 'Add slot')}
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
          {/* P62-G: text layers are Pro — the add-text control is absent from the free
              WP.org build. In the premium build the runtime isPro check below still
              upsells expired/unlicensed installs. */}
          {__WPSG_PREMIUM__ && (
            <Tooltip label={tr('lb_layers_add_text', 'Add text')}>
              <ActionIcon
                size="sm"
                variant="light"
                onClick={() => {
                  // P62-A: text layers are a Pro feature. Gate the entry point;
                  // the underlying data model/hook is untouched (existing text
                  // layers still render for everyone — see server-side freeze).
                  if (!isPro) {
                    showProUpsell(
                      'upsell_text_layers',
                      'Text layers are a Pro feature. Upgrade to add and edit text in your layouts.',
                      upgradeUrl,
                    );
                    return;
                  }
                  const id = builder.addText();
                  setSelectedOverlayId(null);
                  setIsBackgroundSelected(false);
                  setSelectedMaskSlotId(null);
                  setSelectedGuideId(null);
                  builder.clearSelection();
                  setSelectedTextId(id);
                }}
                aria-label={tr('lb_layers_add_text', 'Add text')}
              >
                <IconLetterT size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label={tr('lb_layers_add_mask', 'Add mask to selected slot')}>
            <ActionIcon
              size="sm"
              variant="light"
              onClick={handleAddMask}
              disabled={!canAddMask}
              aria-label={tr('lb_layers_add_mask', 'Add mask to selected slot')}
            >
              <IconMask size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_delete_sel', 'Delete selected')}>
            <ActionIcon
              size="sm"
              variant="light"
              color="red"
              onClick={handleDeleteSelected}
              disabled={builder.selectedSlotIds.size === 0}
              aria-label={tr('lb_layers_delete_sel_aria', 'Delete selected slots')}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_dup_sel', 'Duplicate selected')}>
            <ActionIcon
              size="sm"
              variant="light"
              onClick={handleDuplicateSelected}
              disabled={builder.selectedSlotIds.size === 0}
              aria-label={tr('lb_layers_dup_sel_aria', 'Duplicate selected slots')}
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}

      {/* Alignment toolbar — shown when 2+ slots selected */}
      {!builder.isPreview && builder.selectedSlotIds.size >= 2 && (
        <Group
          gap={2}
          px={6}
          py={3}
          style={{
            borderBottom: '1px solid var(--wpsg-builder-border)',
            flexShrink: 0,
          }}
        >
          <Tooltip label={tr('lb_layers_align_left', 'Align left edges')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(alignSlotsLeft)} aria-label={tr('lb_layers_align_left', 'Align left edges')}>
              <IconAlignBoxLeftMiddle size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_center_h', 'Center horizontally')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(centerSlotsHorizontally)} aria-label={tr('lb_layers_center_h', 'Center horizontally')}>
              <IconAlignBoxCenterMiddle size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_align_right', 'Align right edges')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(alignSlotsRight)} aria-label={tr('lb_layers_align_right', 'Align right edges')}>
              <IconAlignBoxRightMiddle size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_dist_hc_tt', 'Distribute by center (horizontal)')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(distributeSlotsHorizontally)} aria-label={tr('lb_layers_dist_hc_aria', 'Distribute horizontally by center')}>
              <IconLayoutDistributeHorizontal size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_dist_hg_tt', 'Distribute by gap (horizontal)')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(distributeSlotsHorizontallyByGap)} aria-label={tr('lb_layers_dist_hg_aria', 'Distribute horizontally by gap')}>
              <IconLayoutDistributeHorizontalFilled size={13} />
            </ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Tooltip label={tr('lb_layers_align_top', 'Align top edges')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(alignSlotsTop)} aria-label={tr('lb_layers_align_top', 'Align top edges')}>
              <IconAlignBoxTopCenter size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_center_v', 'Center vertically')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(centerSlotsVertically)} aria-label={tr('lb_layers_center_v', 'Center vertically')}>
              <IconAlignBoxCenterTop size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_align_bottom', 'Align bottom edges')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(alignSlotsBottom)} aria-label={tr('lb_layers_align_bottom', 'Align bottom edges')}>
              <IconAlignBoxBottomCenter size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_dist_vc_tt', 'Distribute by center (vertical)')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(distributeSlotsVertically)} aria-label={tr('lb_layers_dist_vc_aria', 'Distribute vertically by center')}>
              <IconLayoutDistributeVertical size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr('lb_layers_dist_vg_tt', 'Distribute by gap (vertical)')}>
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignmentGroupAware(distributeSlotsVerticallyByGap)} aria-label={tr('lb_layers_dist_vg_aria', 'Distribute vertically by gap')}>
              <IconLayoutDistributeVerticalFilled size={13} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}

      {/* Layer search filter */}
      <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--wpsg-builder-border)', flexShrink: 0 }}>
        <TextInput
          size="xs"
          placeholder={tr('lb_layers_filter_ph', 'Filter layers…')}
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={12} />}
          rightSection={
            filterQuery
              ? (
                <ActionIcon size="xs" variant="transparent" onClick={() => setFilterQuery('')} aria-label={tr('lb_layers_clear_filter', 'Clear filter')}>
                  <IconX size={12} />
                </ActionIcon>
              )
              : null
          }
          styles={{ input: { background: 'var(--wpsg-builder-surface)', color: 'var(--wpsg-builder-text)', borderColor: 'var(--wpsg-builder-border)' } }}
        />
      </div>

      {/* Unified layer list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <LayerPanel
          template={builder.template}
          filterText={filterQuery}
          selectedSlotIds={builder.selectedSlotIds}
          selectedOverlayId={selectedOverlayId}
          selectedTextId={selectedTextId}
          isBackgroundSelected={isBackgroundSelected}
          selectedMaskSlotId={selectedMaskSlotId}
          onSelectSlot={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            setSelectedGuideId(null);
            builder.selectSlot(id);
          }}
          onToggleSelectSlot={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            setSelectedGuideId(null);
            builder.toggleSlotSelection(id);
          }}
          onRangeSelectSlot={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            setSelectedGuideId(null);
            const slotLayers = buildLayerList(builder.template).filter((l) => l.kind === 'slot');
            const clickedIdx = slotLayers.findIndex((l) => l.id === id);
            const selectedArr = [...builder.selectedSlotIds];
            const anchorId = selectedArr.length > 0 ? selectedArr[selectedArr.length - 1] : undefined;
            const anchorIdx = anchorId ? slotLayers.findIndex((l) => l.id === anchorId) : -1;
            if (anchorIdx >= 0 && clickedIdx >= 0) {
              const [from, to] = [Math.min(anchorIdx, clickedIdx), Math.max(anchorIdx, clickedIdx)];
              builder.selectSlotsInRange(slotLayers.slice(from, to + 1).map((l) => l.id));
            } else {
              builder.selectSlot(id);
            }
          }}
          onSelectOverlay={(id) => {
            setSelectedOverlayId(id);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            setSelectedTextId(null);
            setSelectedGuideId(null);
            builder.clearSelection();
          }}
          onSelectText={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            setSelectedGuideId(null);
            builder.clearSelection();
            setSelectedTextId(id);
          }}
          onSelectBackground={() => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(true);
            setSelectedMaskSlotId(null);
            setSelectedGuideId(null);
            builder.clearSelection();
            // Focus media panel in dockview and expand Design Assets accordion
            dockApiRef.current?.getPanel('media')?.api.setActive();
            setDesignAssetsOpen(true);
            try {
              localStorage.setItem(`wpsg_builder_${rootId}_design_assets_open`, 'true');
            } catch { /* ignore */ }
            requestAnimationFrame(() =>
              bgSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
            );
          }}
          onClearSelection={() => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            setSelectedGuideId(null);
            builder.clearSelection();
          }}
          onSelectMask={(parentSlotId) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(parentSlotId);
            setSelectedGuideId(null);
            // Also select the parent slot so properties panel shows slot props
            builder.selectSlot(parentSlotId);
          }}
          onToggleMaskVisible={handleToggleMaskVisible}
          onRenameSlot={builder.renameSlot}
          onRenameOverlay={builder.renameOverlay}
          onRenameText={builder.renameText}
          onToggleSlotVisible={builder.toggleSlotVisible}
          onToggleOverlayVisible={builder.toggleOverlayVisible}
          onToggleTextVisible={builder.toggleTextVisible}
          onToggleSlotLocked={builder.toggleSlotLocked}
          onToggleOverlayLocked={builder.toggleOverlayLocked}
          onToggleTextLocked={builder.toggleTextLocked}
          onReorderLayers={builder.reorderLayers}
          onBringToFront={(id) => {
            if (
              builder.template.slots.some((s) => s.id === id) ||
              builder.template.overlays.some((o) => o.id === id) ||
              (builder.template.texts ?? []).some((t) => t.id === id)
            )
              builder.bringToFront([id]);
          }}
          onSendToBack={(id) => {
            if (
              builder.template.slots.some((s) => s.id === id) ||
              builder.template.overlays.some((o) => o.id === id) ||
              (builder.template.texts ?? []).some((t) => t.id === id)
            )
              builder.sendToBack([id]);
          }}
          onBringForward={(id) => {
            if (
              builder.template.slots.some((s) => s.id === id) ||
              builder.template.overlays.some((o) => o.id === id) ||
              (builder.template.texts ?? []).some((t) => t.id === id)
            )
              builder.bringForward([id]);
          }}
          onSendBackward={(id) => {
            if (
              builder.template.slots.some((s) => s.id === id) ||
              builder.template.overlays.some((o) => o.id === id) ||
              (builder.template.texts ?? []).some((t) => t.id === id)
            )
              builder.sendBackward([id]);
          }}
          onDeleteLayer={handleDeleteLayer}
          onAddMask={handleAddMaskForSlot}
          onSelectGroup={(groupId) => {
            builder.selectGroup(groupId);
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            setSelectedGuideId(null);
          }}
          onDissolveGroup={builder.dissolveGroup}
          onToggleGroupCollapsed={(groupId, collapsed) =>
            builder.updateGroup(groupId, { collapsed })
          }
          onReparentGroup={(groupId, newParentId) =>
            builder.reparentGroup(groupId, newParentId)
          }
        />
      </div>
    </div>
  );
}

setWpsgDebugDisplayName(LayoutBuilderLayersPanel, 'LayoutBuilder:LayoutBuilderLayersPanel');
