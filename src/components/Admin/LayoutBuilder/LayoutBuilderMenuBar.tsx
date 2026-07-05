import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Button, Divider, Group } from '@mantine/core';
import {
  IconChevronDown,
  IconDeviceFloppy,
  IconDownload,
  IconUpload,
  IconX,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCopy,
  IconTrash,
  IconHistory,
  IconLayout,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconGrid4x4,
  IconRuler,
  IconDimensions,
  IconRefresh,
  IconCheck,
} from '@tabler/icons-react';
import type { DockviewApi } from 'dockview';
import type { LayoutScope } from '@/hooks/useBuilderWorkspacePrefs';

// The four panel ids used in the default layout.
const SIDE_PANELS = ['layers', 'media', 'properties'] as const;
type SidePanel = typeof SIDE_PANELS[number];

const PANEL_LABELS: Record<SidePanel, string> = {
  layers: 'Layers',
  media: 'Media & Assets',
  properties: 'Properties',
};

const PANEL_ICONS: Record<SidePanel, React.ReactNode> = {
  layers: <IconLayoutSidebar size={14} />,
  media: <IconLayout size={14} />,
  properties: <IconLayoutSidebarRight size={14} />,
};

// Default positions to use when re-adding a closed panel.
const PANEL_DEFAULTS: Record<SidePanel, { component: string; title: string }> = {
  layers: { component: 'layers', title: 'Layers' },
  media: { component: 'media', title: 'Media & Assets' },
  properties: { component: 'properties', title: 'Properties' },
};

export interface LayoutBuilderMenuBarProps {
  // builder state
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
  onOpenGridGenerator: () => void;
  // file actions
  onExport: () => void;
  onImport: () => void;
  onSave: () => void;
  onClose: () => void;
  // view prefs
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  showRulers: boolean;
  setShowRulers: (v: boolean) => void;
  showMeasurements: boolean;
  setShowMeasurements: (v: boolean) => void;
  // dockview
  dockApiRef: React.RefObject<DockviewApi | null>;
  templateId: string;
  rootId: string;
  // options
  layoutScope: LayoutScope;
  setLayoutScope: (scope: LayoutScope) => void;
  // guides (P59-F)
  guideCount: number;
  onClearGuides: () => void;
}

function MenuButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Menu shadow="md" width={220} position="bottom-start" withinPortal>
      <Menu.Target>
        <Button
          variant="subtle"
          size="compact-xs"
          rightSection={<IconChevronDown size={10} />}
          styles={{ root: { fontWeight: 500, fontSize: 12, letterSpacing: 0 } }}
        >
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>{children}</Menu.Dropdown>
    </Menu>
  );
}

function CheckItem({
  checked,
  label,
  icon,
  onClick,
}: {
  checked: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Menu.Item
      leftSection={icon ?? <span style={{ width: 14 }} />}
      rightSection={checked ? <IconCheck size={12} /> : <span style={{ width: 12 }} />}
      onClick={onClick}
    >
      {label}
    </Menu.Item>
  );
}

export function LayoutBuilderMenuBar({
  canUndo, canRedo, hasSelection,
  onUndo, onRedo, onDuplicate, onDelete, onOpenHistory, onOpenGridGenerator,
  onExport, onImport, onSave, onClose,
  showGrid, setShowGrid,
  showRulers, setShowRulers,
  showMeasurements, setShowMeasurements,
  dockApiRef, templateId, rootId,
  layoutScope, setLayoutScope,
  guideCount, onClearGuides,
}: LayoutBuilderMenuBarProps) {
  const { t } = useTranslation('wpsg');
  const panelTitle = useCallback((id: SidePanel) => t(`lb_menu_panel_${id}`, PANEL_LABELS[id]), [t]);
  // Track which side panels are open — queried from dockview on each menu open.
  const [openPanels, setOpenPanels] = useState<Set<SidePanel>>(new Set(SIDE_PANELS));

  const refreshPanelState = useCallback(() => {
    const api = dockApiRef.current;
    if (!api) return;
    setOpenPanels(new Set(SIDE_PANELS.filter((id) => !!api.getPanel(id))));
  }, [dockApiRef]);

  const togglePanel = useCallback((id: SidePanel) => {
    const api = dockApiRef.current;
    if (!api) return;
    const panel = api.getPanel(id);
    if (panel) {
      panel.api.close();
      setOpenPanels((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      // Re-add the panel. Place it in a sensible default position.
      const def = PANEL_DEFAULTS[id];
      try {
        if (id === 'properties') {
          // Properties belongs on the right — add relative to canvas if it exists.
          const canvas = api.getPanel('canvas');
          api.addPanel({
            id,
            component: def.component,
            title: panelTitle(id),
            ...(canvas ? { position: { direction: 'right', referencePanel: canvas } } : {}),
          });
        } else {
          // Layers / Media go on the left — add to the left of canvas or create tab group.
          const layers = api.getPanel('layers');
          const media = api.getPanel('media');
          const reference = layers ?? media ?? api.getPanel('canvas');
          const direction = (id === 'media' && layers) ? 'within' : (reference ? 'left' : undefined);
          api.addPanel({
            id,
            component: def.component,
            title: panelTitle(id),
            ...(reference && direction ? { position: { direction, referencePanel: reference } } : {}),
          });
        }
      } catch {
        // Fallback: add without position if placement fails.
        api.addPanel({ id, component: def.component, title: def.title });
      }
      setOpenPanels((prev) => new Set([...prev, id]));
    }
  }, [dockApiRef, panelTitle]);

  const handleResetLayout = useCallback(() => {
    const api = dockApiRef.current;
    if (!api) return;
    // Clear persisted layout for the active scope.
    const key = layoutScope === 'per-template' && templateId
      ? `wpsg_builder_${rootId}_template_${templateId}_layout`
      : `wpsg_builder_${rootId}_layout`;
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    // Remove all panels and restore defaults.
    for (const id of SIDE_PANELS) {
      try { api.getPanel(id)?.api.close(); } catch { /* ignore */ }
    }
    try { api.getPanel('canvas')?.api.close(); } catch { /* ignore */ }
    const layersPanel = api.addPanel({ id: 'layers', component: 'layers', title: panelTitle('layers') });
    api.addPanel({ id: 'media', component: 'media', title: panelTitle('media'), position: { direction: 'within', referencePanel: layersPanel } });
    const canvasPanel = api.addPanel({ id: 'canvas', component: 'canvas', tabComponent: 'canvas', title: t('lb_menu_panel_canvas', 'Canvas'), position: { direction: 'right', referencePanel: layersPanel } });
    api.addPanel({ id: 'properties', component: 'properties', title: panelTitle('properties'), position: { direction: 'right', referencePanel: canvasPanel } });
    setOpenPanels(new Set(SIDE_PANELS));
  }, [dockApiRef, layoutScope, rootId, templateId, panelTitle, t]);

  return (
    <Group gap={2} wrap="nowrap">
      {/* ── File ── */}
      <MenuButton label={t('lb_menu_file', 'File')}>
        <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={onSave}>
          {t('lb_menu_save', 'Save')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconDownload size={14} />} onClick={onExport}>
          {t('lb_menu_export', 'Export template…')}
        </Menu.Item>
        <Menu.Item leftSection={<IconUpload size={14} />} onClick={onImport}>
          {t('lb_menu_import', 'Import from file…')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconX size={14} />} onClick={onClose}>
          {t('lb_menu_close', 'Close editor')}
        </Menu.Item>
      </MenuButton>

      {/* ── Edit ── */}
      <MenuButton label={t('lb_menu_edit', 'Edit')}>
        <Menu.Item leftSection={<IconArrowBackUp size={14} />} onClick={onUndo} disabled={!canUndo}>
          {t('lb_menu_undo', 'Undo')}
        </Menu.Item>
        <Menu.Item leftSection={<IconArrowForwardUp size={14} />} onClick={onRedo} disabled={!canRedo}>
          {t('lb_menu_redo', 'Redo')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconCopy size={14} />} onClick={onDuplicate} disabled={!hasSelection}>
          {t('lb_menu_duplicate', 'Duplicate')}
        </Menu.Item>
        <Menu.Item leftSection={<IconTrash size={14} />} onClick={onDelete} disabled={!hasSelection} color="red">
          {t('lb_menu_delete', 'Delete')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconGrid4x4 size={14} />} onClick={onOpenGridGenerator}>
          {t('lb_menu_gen_grid', 'Generate grid…')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconHistory size={14} />} onClick={onOpenHistory}>
          {t('lb_menu_history', 'History…')}
        </Menu.Item>
      </MenuButton>

      {/* ── View ── */}
      <Menu shadow="md" width={220} position="bottom-start" withinPortal onOpen={refreshPanelState}>
        <Menu.Target>
          <Button
            variant="subtle"
            size="compact-xs"
            rightSection={<IconChevronDown size={10} />}
            styles={{ root: { fontWeight: 500, fontSize: 12, letterSpacing: 0 } }}
          >
            {t('lb_menu_view', 'View')}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t('lb_menu_panels', 'Panels')}</Menu.Label>
          {SIDE_PANELS.map((id) => (
            <CheckItem
              key={id}
              checked={openPanels.has(id)}
              label={panelTitle(id)}
              icon={PANEL_ICONS[id]}
              onClick={() => togglePanel(id)}
            />
          ))}
          <Menu.Divider />
          <Menu.Label>{t('lb_menu_canvas', 'Canvas')}</Menu.Label>
          <CheckItem checked={showGrid} label={t('lb_menu_show_grid', 'Show grid')} icon={<IconGrid4x4 size={14} />} onClick={() => setShowGrid(!showGrid)} />
          <CheckItem checked={showRulers} label={t('lb_menu_show_rulers', 'Show rulers')} icon={<IconRuler size={14} />} onClick={() => setShowRulers(!showRulers)} />
          <CheckItem checked={showMeasurements} label={t('lb_menu_show_meas', 'Show measurements')} icon={<IconDimensions size={14} />} onClick={() => setShowMeasurements(!showMeasurements)} />
          <Menu.Item
            leftSection={<IconTrash size={14} />}
            onClick={onClearGuides}
            disabled={guideCount === 0}
            color="red"
          >
            {t('lb_menu_clear_guides', 'Clear guides')}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item leftSection={<IconRefresh size={14} />} onClick={handleResetLayout}>
            {t('lb_menu_reset_layout', 'Reset layout')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* ── Options ── */}
      <MenuButton label={t('lb_menu_options', 'Options')}>
        <Menu.Label>{t('lb_menu_workspace', 'Layout workspace')}</Menu.Label>
        <CheckItem
          checked={layoutScope === 'global'}
          label={t('lb_menu_scope_global', 'Shared across all templates')}
          onClick={() => setLayoutScope('global')}
        />
        <CheckItem
          checked={layoutScope === 'per-template'}
          label={t('lb_menu_scope_per', 'Save per template')}
          onClick={() => setLayoutScope('per-template')}
        />
      </MenuButton>

      <Divider orientation="vertical" mx={4} />
    </Group>
  );
}
