import { Button, ColorInput, Divider, Group, Modal, NumberInput, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

import {
  adapterUsesSettingGroup,
  getActiveSettingGroupDefinitions,
  getAdapterSelectOptions,
} from '@/components/Galleries/Adapters/adapterRegistry';
import { ModalSelect as Select } from '@/components/Common/ModalSelect';
import type {
  AdapterSettingFieldDefinition,
  AdapterSettingGroupDefinition,
  AdapterSettingGroupScopeMode,
} from '@/components/Galleries/Adapters/GalleryAdapter';
import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryCommonSettings,
  type GalleryConfig,
  type GalleryConfigBreakpoint,
  type GalleryConfigMode,
  type GalleryConfigScope,
} from '@/types';
import { cloneGalleryConfig, getLegacyViewportBackgroundFieldMap } from '@/utils/galleryConfig';

const GALLERY_BREAKPOINTS: GalleryConfigBreakpoint[] = ['desktop', 'tablet', 'mobile'];
type EditableGalleryScope = Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>;

interface GalleryConfigEditorModalProps {
  opened: boolean;
  title: string;
  value?: Partial<GalleryConfig>;
  onClose: () => void;
  onSave: (value: GalleryConfig | undefined) => void;
  onChange?: (value: GalleryConfig | undefined) => void;
  onClear?: () => void;
  contextSummary?: string;
  saveLabel?: string;
  clearLabel?: string;
  clearMode?: 'external' | 'draft';
  unifiedAdapterEnabled?: boolean;
  unifiedAdapterDescription?: string;
  zIndex?: number;
}

type SharedCommonSettingKey = keyof Pick<
  GalleryCommonSettings,
  | 'sectionMaxWidth'
  | 'sectionMaxHeight'
  | 'sectionMinWidth'
  | 'sectionMinHeight'
  | 'sectionHeightMode'
  | 'perTypeSectionEqualHeight'
  | 'sectionPadding'
  | 'adapterContentPadding'
  | 'adapterSizingMode'
  | 'adapterMaxWidthPct'
  | 'adapterMaxHeightPct'
  | 'adapterItemGap'
  | 'adapterJustifyContent'
  | 'gallerySizingMode'
  | 'galleryManualHeight'
  | 'galleryImageLabel'
  | 'galleryVideoLabel'
  | 'galleryLabelJustification'
  | 'showGalleryLabelIcon'
  | 'showCampaignGalleryLabels'
>;

type ScopeSpecificCommonSettingKey = keyof Pick<
  GalleryCommonSettings,
  'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'
>;

function getScopeAdapterId(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  scope: EditableGalleryScope,
): string {
  return config?.breakpoints?.[breakpoint]?.[scope]?.adapterId ?? '';
}

function getEditableScopes(mode: GalleryConfigMode): Array<EditableGalleryScope> {
  return mode === 'unified' ? ['unified'] : ['image', 'video'];
}

function formatScopeLabel(scope: EditableGalleryScope): string {
  switch (scope) {
    case 'unified':
      return 'Unified Gallery';
    case 'image':
      return 'Image Gallery';
    case 'video':
      return 'Video Gallery';
  }
}

function getScopeViewportBackgroundFallbacks(scope: EditableGalleryScope) {
  const fieldMap = getLegacyViewportBackgroundFieldMap(scope);

  return {
    viewportBgType: DEFAULT_GALLERY_BEHAVIOR_SETTINGS[fieldMap.viewportBgType],
    viewportBgColor: DEFAULT_GALLERY_BEHAVIOR_SETTINGS[fieldMap.viewportBgColor],
    viewportBgGradient: DEFAULT_GALLERY_BEHAVIOR_SETTINGS[fieldMap.viewportBgGradient],
    viewportBgImageUrl: DEFAULT_GALLERY_BEHAVIOR_SETTINGS[fieldMap.viewportBgImageUrl],
  };
}

function getRepresentativeCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  key: SharedCommonSettingKey,
): number | string | boolean | undefined {
  const scopes = getEditableScopes(config?.mode ?? 'per-type');

  for (const scope of scopes) {
    const value = config?.breakpoints?.[breakpoint]?.[scope]?.common?.[key];
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

function getRepresentativeNumberCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  key: Extract<SharedCommonSettingKey, 'sectionMaxWidth' | 'sectionMaxHeight' | 'sectionMinWidth' | 'sectionMinHeight' | 'sectionPadding' | 'adapterContentPadding' | 'adapterMaxWidthPct' | 'adapterMaxHeightPct' | 'adapterItemGap'>,
): number | undefined {
  const value = getRepresentativeCommonValue(config, breakpoint, key);
  return typeof value === 'number' ? value : undefined;
}

function getRepresentativeStringCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  key: Extract<SharedCommonSettingKey, 'sectionHeightMode' | 'adapterSizingMode' | 'adapterJustifyContent' | 'gallerySizingMode' | 'galleryManualHeight' | 'galleryImageLabel' | 'galleryVideoLabel' | 'galleryLabelJustification'>,
): string | undefined {
  const value = getRepresentativeCommonValue(config, breakpoint, key);
  return typeof value === 'string' ? value : undefined;
}

function getRepresentativeBooleanCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  key: Extract<SharedCommonSettingKey, 'perTypeSectionEqualHeight' | 'showGalleryLabelIcon' | 'showCampaignGalleryLabels'>,
): boolean | undefined {
  const value = getRepresentativeCommonValue(config, breakpoint, key);
  return typeof value === 'boolean' ? value : undefined;
}

function getRepresentativeAdapterSettingValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  group: AdapterSettingGroupDefinition,
  field: AdapterSettingFieldDefinition,
): number | string | boolean | undefined {
  const scopes = getApplicableScopes(config?.mode ?? 'per-type', group.scopeMode ?? 'shared', field);

  for (const scope of scopes) {
    const scopeConfig = config?.breakpoints?.[breakpoint]?.[scope];
    if (!adapterUsesSettingGroup(scopeConfig?.adapterId, group.group)) {
      continue;
    }

    const value = scopeConfig?.adapterSettings?.[field.key];
    if (
      (field.control === 'number' && typeof value === 'number')
      || ((field.control === 'select' || field.control === 'text' || field.control === 'color') && typeof value === 'string')
      || (field.control === 'boolean' && typeof value === 'boolean')
    ) {
      return value;
    }
  }

  return undefined;
}

function getScopeCommonValue(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  scope: EditableGalleryScope,
  key: ScopeSpecificCommonSettingKey,
): string | undefined {
  const value = config?.breakpoints?.[breakpoint]?.[scope]?.common?.[key];
  return typeof value === 'string' ? value : undefined;
}

function pruneConfig(config: GalleryConfig): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? {};

  GALLERY_BREAKPOINTS.forEach((breakpoint) => {
    const breakpointConfig = next.breakpoints?.[breakpoint];
    if (!breakpointConfig) {
      return;
    }

    (['unified', 'image', 'video'] as const).forEach((scope) => {
      const scopeConfig = breakpointConfig[scope];
      if (!scopeConfig) {
        return;
      }

      if (!scopeConfig.adapterId && !scopeConfig.common && !scopeConfig.adapterSettings) {
        delete breakpointConfig[scope];
      }
    });

    if (!Object.keys(breakpointConfig).length) {
      delete next.breakpoints?.[breakpoint];
    }
  });

  return {
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints ?? {},
  };
}

function setConfigMode(config: GalleryConfig, mode: GalleryConfigMode): GalleryConfig {
  return pruneConfig({
    ...config,
    mode,
  });
}

function setScopeAdapterId(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
  adapterId: string,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};
  const breakpointConfig = next.breakpoints[breakpoint] ?? {};

  if (adapterId) {
    breakpointConfig[scope] = {
      ...(breakpointConfig[scope] ?? {}),
      adapterId,
    };
  } else if (breakpointConfig[scope]) {
    delete breakpointConfig[scope]?.adapterId;
  }

  next.breakpoints[breakpoint] = breakpointConfig;
  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

function setCommonSettingForEditableScopes(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  key: SharedCommonSettingKey,
  value: number | string | boolean,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};

  const breakpointConfig = next.breakpoints?.[breakpoint] ?? {};

  getEditableScopes(next.mode ?? 'per-type').forEach((scope) => {
    breakpointConfig[scope] = {
      ...(breakpointConfig[scope] ?? {}),
      common: {
        ...(breakpointConfig[scope]?.common ?? {}),
        [key]: value,
      },
    };
  });

  next.breakpoints[breakpoint] = breakpointConfig;

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

function setCommonSettingForScope(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  scope: EditableGalleryScope,
  key: ScopeSpecificCommonSettingKey,
  value: string,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};

  const breakpointConfig = next.breakpoints?.[breakpoint] ?? {};

  breakpointConfig[scope] = {
    ...(breakpointConfig[scope] ?? {}),
    common: {
      ...(breakpointConfig[scope]?.common ?? {}),
      [key]: value,
    },
  };

  next.breakpoints[breakpoint] = breakpointConfig;

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

function getApplicableScopes(
  mode: GalleryConfigMode,
  scopeMode: AdapterSettingGroupScopeMode,
  field: AdapterSettingFieldDefinition,
): Array<EditableGalleryScope> {
  const editableScopes = getEditableScopes(mode);
  const appliesTo = field.appliesTo ?? 'always';

  if (appliesTo === 'always') {
    return editableScopes;
  }

  const allowedScopes = Array.isArray(appliesTo) ? appliesTo : [appliesTo];

  if (scopeMode === 'contextual') {
    return editableScopes.filter((scope) => allowedScopes.includes(scope));
  }

  return editableScopes.filter((scope) => allowedScopes.includes(scope));
}

function hasVisibleAdapterSettingField(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  group: AdapterSettingGroupDefinition,
  field: AdapterSettingFieldDefinition,
): boolean {
  return getApplicableScopes(config.mode ?? 'per-type', group.scopeMode ?? 'shared', field).some((scope) =>
    adapterUsesSettingGroup(config.breakpoints?.[breakpoint]?.[scope]?.adapterId, group.group),
  );
}

const CONDITIONAL_ADAPTER_FIELD_CONTROLLERS = {
  imageShadowCustom: {
    controllerKey: 'imageShadowPreset',
    isVisible: (value: number | string | boolean | undefined) => value === 'custom',
  },
  videoShadowCustom: {
    controllerKey: 'videoShadowPreset',
    isVisible: (value: number | string | boolean | undefined) => value === 'custom',
  },
  tileBorderColor: {
    controllerKey: 'tileBorderWidth',
    isVisible: (value: number | string | boolean | undefined) => typeof value === 'number' && value > 0,
  },
  tileGlowColor: {
    controllerKey: 'tileGlowEnabled',
    isVisible: (value: number | string | boolean | undefined) => value === true,
  },
  tileGlowSpread: {
    controllerKey: 'tileGlowEnabled',
    isVisible: (value: number | string | boolean | undefined) => value === true,
  },
} as const;

function shouldRenderAdapterSettingField(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  group: AdapterSettingGroupDefinition,
  field: AdapterSettingFieldDefinition,
): boolean {
  if (!hasVisibleAdapterSettingField(config, breakpoint, group, field)) {
    return false;
  }

  const controller = CONDITIONAL_ADAPTER_FIELD_CONTROLLERS[field.key as keyof typeof CONDITIONAL_ADAPTER_FIELD_CONTROLLERS];
  if (!controller) {
    return true;
  }

  const controllerField = group.fields.find((candidate) => candidate.key === controller.controllerKey);
  if (!controllerField) {
    return true;
  }

  return controller.isVisible(getRepresentativeAdapterSettingValue(config, breakpoint, group, controllerField));
}

function formatSettingGroupLabel(group: AdapterSettingGroupDefinition['group']): string {
  switch (group) {
    case 'media-frame':
      return 'Media Frame';
    case 'photo-grid':
      return 'Photo Grid';
    case 'tile-appearance':
      return 'Tile Appearance';
    case 'compact-grid':
      return 'Compact Grid';
    case 'layout-builder':
      return 'Layout Builder';
    case 'shape':
      return 'Shape Layout';
    default:
      return group.charAt(0).toUpperCase() + group.slice(1);
  }
}

function setAdapterSettingForMatchingScopes(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  group: AdapterSettingGroupDefinition,
  field: AdapterSettingFieldDefinition,
  value: number | string | boolean,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};
  const breakpointConfig = next.breakpoints[breakpoint] ?? {};

  getApplicableScopes(next.mode ?? 'per-type', group.scopeMode ?? 'shared', field).forEach((scope) => {
    if (!adapterUsesSettingGroup(breakpointConfig[scope]?.adapterId, group.group)) {
      return;
    }

    breakpointConfig[scope] = {
      ...(breakpointConfig[scope] ?? {}),
      adapterSettings: {
        ...(breakpointConfig[scope]?.adapterSettings ?? {}),
        [field.key]: value,
      },
    };
  });

  next.breakpoints[breakpoint] = breakpointConfig;

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

function resetBreakpointToBaseline(
  draft: GalleryConfig,
  baseline: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
): GalleryConfig {
  const next = cloneGalleryConfig(draft) ?? { mode: draft.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};

  const baselineBreakpoint = cloneGalleryConfig(baseline)?.breakpoints?.[breakpoint];
  if (baselineBreakpoint) {
    next.breakpoints[breakpoint] = baselineBreakpoint;
  } else {
    delete next.breakpoints[breakpoint];
  }

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

function resetScopeToBaseline(
  draft: GalleryConfig,
  baseline: GalleryConfig,
  scope: EditableGalleryScope,
): GalleryConfig {
  const next = cloneGalleryConfig(draft) ?? { mode: draft.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};
  const baselineClone = cloneGalleryConfig(baseline);

  GALLERY_BREAKPOINTS.forEach((breakpoint) => {
    const breakpointConfig = next.breakpoints?.[breakpoint] ?? {};
    const baselineScopeConfig = baselineClone?.breakpoints?.[breakpoint]?.[scope];

    if (baselineScopeConfig) {
      breakpointConfig[scope] = baselineScopeConfig;
      next.breakpoints![breakpoint] = breakpointConfig;
      return;
    }

    if (!breakpointConfig[scope]) {
      return;
    }

    delete breakpointConfig[scope];

    if (Object.keys(breakpointConfig).length) {
      next.breakpoints![breakpoint] = breakpointConfig;
    } else {
      delete next.breakpoints![breakpoint];
    }
  });

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

export function GalleryConfigEditorModal({
  opened,
  title,
  value,
  onClose,
  onSave,
  onChange,
  onClear,
  contextSummary,
  saveLabel = 'Apply Gallery Config',
  clearLabel = 'Clear Overrides',
  clearMode = 'external',
  unifiedAdapterEnabled = true,
  unifiedAdapterDescription,
  zIndex,
}: GalleryConfigEditorModalProps) {
  const [draft, setDraft] = useState<GalleryConfig | undefined>(undefined);
  const [baseline, setBaseline] = useState<GalleryConfig | undefined>(undefined);
  const [activeBreakpoint, setActiveBreakpoint] = useState<GalleryConfigBreakpoint>('desktop');
  const resolvedDraft = draft ?? { mode: 'per-type' as const, breakpoints: {} };
  const resolvedBaseline = baseline ?? { mode: 'per-type' as const, breakpoints: {} };
  const updateDraft = (updater: (current: GalleryConfig) => GalleryConfig) => {
    setDraft((current) => updater(current ?? { mode: 'per-type', breakpoints: {} }));
  };
  const activeSettingGroups = getActiveSettingGroupDefinitions(
    getEditableScopes(resolvedDraft.mode ?? 'per-type').map((scope) => resolvedDraft.breakpoints?.[activeBreakpoint]?.[scope]?.adapterId),
  ).filter((group) => group.fields.some((field) => shouldRenderAdapterSettingField(resolvedDraft, activeBreakpoint, group, field)));
  const unifiedAdapterHelpText = `${unifiedAdapterDescription ?? 'Adapter applied when images and videos render together.'} Each breakpoint tab controls its own unified adapter and responsive settings.`;

  useEffect(() => {
    if (!opened) {
      return;
    }

    const nextBaseline = value
      ? pruneConfig(cloneGalleryConfig(value as GalleryConfig) ?? { mode: 'per-type', breakpoints: {} })
      : undefined;
    setBaseline(nextBaseline);
    setDraft(nextBaseline);
    setActiveBreakpoint('desktop');
  }, [opened, value]);

  useEffect(() => {
    if (!opened || !onChange) {
      return;
    }

    onChange(draft ? pruneConfig(draft) : undefined);
  }, [draft, onChange, opened]);

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg" centered zIndex={zIndex}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          This shared editor owns the nested gallery selection model. Inline selectors remain available for quick scanning and small edits.
        </Text>

        {contextSummary && (
          <Text size="sm" fw={500} c="blue">
            {contextSummary}
          </Text>
        )}

        <Select
          label="Gallery Mode"
          description="Choose whether this config resolves a unified gallery or separate image and video galleries."
          data={[
            { value: 'unified', label: 'Unified' },
            { value: 'per-type', label: 'Per-Type' },
          ]}
          value={resolvedDraft.mode ?? 'per-type'}
          onChange={(nextMode) => {
            if (nextMode === 'unified' || nextMode === 'per-type') {
              updateDraft((current) => setConfigMode(current, nextMode));
            }
          }}
        />

        {resolvedDraft.mode === 'unified' ? (
          unifiedAdapterEnabled ? (
            <Text size="sm" c="dimmed">
              {unifiedAdapterHelpText}
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              Unified mode selection is supported here, but campaign-level unified adapter overrides still inherit the global unified adapter in this slice.
            </Text>
          )
        ) : null}

        <Tabs value={activeBreakpoint} onChange={(value) => value && setActiveBreakpoint(value as GalleryConfigBreakpoint)}>
          <Tabs.List grow>
            {GALLERY_BREAKPOINTS.map((breakpoint) => (
              <Tabs.Tab key={breakpoint} value={breakpoint}>
                {breakpoint.charAt(0).toUpperCase() + breakpoint.slice(1)}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {GALLERY_BREAKPOINTS.map((breakpoint) => {
            if (resolvedDraft.mode === 'unified') {
              return (
                <Tabs.Panel key={breakpoint} value={breakpoint} pt="md">
                  <Stack gap="md">
                    <Text size="sm" c="dimmed">
                      Editing breakpoint-specific unified settings for the {breakpoint} layout.
                    </Text>
                    {unifiedAdapterEnabled ? (
                      <Select
                        label="Unified Gallery Adapter"
                        description={`Unified gallery adapter for the ${breakpoint} breakpoint.`}
                        data={getAdapterSelectOptions({ context: 'unified-gallery', breakpoint })}
                        value={getScopeAdapterId(resolvedDraft, breakpoint, 'unified') || null}
                        onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'unified', adapterId ?? ''))}
                        clearable
                        placeholder="Default adapter"
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                        Unified adapter overrides remain inherited in this slice.
                      </Text>
                    )}
                  </Stack>
                </Tabs.Panel>
              );
            }

            const adapterOptions = getAdapterSelectOptions({
              context: 'per-breakpoint-gallery',
              breakpoint,
            });

            return (
              <Tabs.Panel key={breakpoint} value={breakpoint} pt="md">
                <Stack gap="md">
                  <Select
                    label="Image Adapter"
                    description={`Image gallery adapter for the ${breakpoint} breakpoint.`}
                    data={adapterOptions}
                    value={getScopeAdapterId(resolvedDraft, breakpoint, 'image') || null}
                    onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'image', adapterId ?? ''))}
                    clearable
                    placeholder="Default adapter"
                  />
                  <Select
                    label="Video Adapter"
                    description={`Video gallery adapter for the ${breakpoint} breakpoint.`}
                    data={adapterOptions}
                    value={getScopeAdapterId(resolvedDraft, breakpoint, 'video') || null}
                    onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'video', adapterId ?? ''))}
                    clearable
                    placeholder="Default adapter"
                  />
                </Stack>
              </Tabs.Panel>
            );
          })}
        </Tabs>

        <Text size="xs" c="dimmed">
          Settings below apply to the {activeBreakpoint} breakpoint {resolvedDraft.mode === 'unified'
            ? 'for the unified gallery surface.'
            : 'for the current per-type gallery surface.'}
        </Text>

        <Divider label="Shared Section Sizing" labelPosition="center" />

        <NumberInput
          label="Gallery Section Max Width (px)"
          description="Maximum width for each gallery section. 0 keeps the section fully responsive."
          value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMaxWidth') ?? 0}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMaxWidth', typeof value === 'number' ? value : 0))}
          min={0}
          max={2000}
          step={50}
        />

        <NumberInput
          label="Gallery Section Min Width (px)"
          description="Minimum width floor for each gallery section."
          value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMinWidth') ?? 300}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMinWidth', typeof value === 'number' ? value : 300))}
          min={200}
          max={600}
          step={50}
        />

        <Select
          label="Section Height Mode"
          description="How section height is determined. Auto is content-driven and remains the safest default for masonry and justified layouts."
          data={[
            { value: 'auto', label: 'Auto (content-driven)' },
            { value: 'manual', label: 'Manual (fixed max height)' },
            { value: 'viewport', label: 'Viewport (% of screen)' },
          ]}
          value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'sectionHeightMode') ?? 'auto'}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionHeightMode', value ?? 'auto'))}
          allowDeselect={false}
        />

        {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'sectionHeightMode') === 'manual' && (
          <NumberInput
            label="Gallery Section Max Height (px)"
            description="Maximum height used when section height mode is manual."
            value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMaxHeight') ?? 0}
            onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMaxHeight', typeof value === 'number' ? value : 0))}
            min={0}
            max={2000}
            step={50}
          />
        )}

        <NumberInput
          label="Gallery Section Min Height (px)"
          description="Minimum height floor for each gallery section."
          value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMinHeight') ?? 150}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMinHeight', typeof value === 'number' ? value : 150))}
          min={100}
          max={400}
          step={50}
        />

        <Select
          label="Equal Height Sections (Per-Type)"
          description="Controls whether image and video sections align to equal height in per-type layouts on wider viewports."
          data={[
            { value: 'false', label: 'Off' },
            { value: 'true', label: 'On' },
          ]}
          value={String(getRepresentativeBooleanCommonValue(resolvedDraft, activeBreakpoint, 'perTypeSectionEqualHeight') ?? false)}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'perTypeSectionEqualHeight', value === 'true'))}
          allowDeselect={false}
        />

        <Divider label="Shared Section Spacing" labelPosition="center" />

        <NumberInput
          label="Section Padding (px)"
          description="Applies the same inner section padding across the currently edited gallery mode surface."
          value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionPadding') ?? 16}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionPadding', typeof value === 'number' ? value : 16))}
          min={0}
          max={32}
          step={4}
        />

        <NumberInput
          label="Adapter Content Padding (px)"
          description="Applies the same inner adapter padding across the currently edited gallery mode surface."
          value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterContentPadding') ?? 0}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterContentPadding', typeof value === 'number' ? value : 0))}
          min={0}
          max={24}
          step={4}
        />

        <Divider label="Shared Adapter Sizing" labelPosition="center" />

        <Select
          label="Adapter Sizing Mode"
          description="How adapters fill their gallery section. Fill uses the full section; Manual lets you cap width and height percentages."
          data={[
            { value: 'fill', label: 'Fill (100%)' },
            { value: 'manual', label: 'Manual (custom %)' },
          ]}
          value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'adapterSizingMode') ?? 'fill'}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterSizingMode', value ?? 'fill'))}
          allowDeselect={false}
        />

        {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'adapterSizingMode') === 'manual' && (
          <>
            <NumberInput
              label="Adapter Max Width (%)"
              description="Maximum adapter width as a percentage of its gallery section."
              value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterMaxWidthPct') ?? 100}
              onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterMaxWidthPct', typeof value === 'number' ? value : 100))}
              min={50}
              max={100}
              step={5}
            />

            <NumberInput
              label="Adapter Max Height (%)"
              description="Maximum adapter height as a percentage of its gallery section."
              value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterMaxHeightPct') ?? 100}
              onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterMaxHeightPct', typeof value === 'number' ? value : 100))}
              min={50}
              max={100}
              step={5}
            />
          </>
        )}

        <NumberInput
          label="Adapter Item Gap (px)"
          description="Applies shared item spacing across the currently edited gallery mode surface."
          value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterItemGap') ?? 16}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterItemGap', typeof value === 'number' ? value : 16))}
          min={0}
          max={64}
          step={4}
        />

        <Select
          label="Adapter Justification"
          description="Controls how adapter items distribute inside the section for adapters that support justification."
          data={[
            { value: 'start', label: 'Start' },
            { value: 'center', label: 'Center' },
            { value: 'end', label: 'End' },
            { value: 'space-between', label: 'Space Between' },
            { value: 'space-evenly', label: 'Space Evenly' },
            { value: 'stretch', label: 'Stretch' },
          ]}
          value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'adapterJustifyContent') ?? 'center'}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterJustifyContent', value ?? 'center'))}
          allowDeselect={false}
        />

        <Divider label="Shared Gallery Height" labelPosition="center" />

        <Select
          label="Height Constraint"
          description="Choose whether classic galleries can overflow, are kept within the visible screen, or use a manual CSS height."
          data={[
            { value: 'auto', label: 'No restraint' },
            { value: 'viewport', label: 'Restrain to view' },
            { value: 'manual', label: 'Manually control height' },
          ]}
          value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'gallerySizingMode') ?? 'auto'}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'gallerySizingMode', value ?? 'auto'))}
          allowDeselect={false}
        />

        {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'gallerySizingMode') === 'manual' && (
          <TextInput
            label="Manual Gallery Height"
            description="Accepted units: px, em, rem, vh, dvh, vw, %. Example: 75vh or 420px"
            value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryManualHeight') ?? '420px'}
            onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryManualHeight', event.currentTarget.value))}
            placeholder="420px"
          />
        )}

        <Divider label="Shared Gallery Presentation" labelPosition="center" />

        <TextInput
          label="Image Gallery Label"
          description="Shared heading text for image gallery sections when labels are enabled."
          value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryImageLabel') ?? 'Images'}
          onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryImageLabel', event.currentTarget.value))}
        />

        <TextInput
          label="Video Gallery Label"
          description="Shared heading text for video gallery sections when labels are enabled."
          value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryVideoLabel') ?? 'Videos'}
          onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryVideoLabel', event.currentTarget.value))}
        />

        <Select
          label="Gallery Label Justification"
          description="Controls how gallery section titles align across the currently edited gallery mode surface."
          data={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryLabelJustification') ?? 'left'}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryLabelJustification', value ?? 'left'))}
          allowDeselect={false}
        />

        <Select
          label="Show Gallery Label Icons"
          description="Displays the adapter icon beside gallery section titles."
          data={[
            { value: 'true', label: 'On' },
            { value: 'false', label: 'Off' },
          ]}
          value={String(getRepresentativeBooleanCommonValue(resolvedDraft, activeBreakpoint, 'showGalleryLabelIcon') ?? false)}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'showGalleryLabelIcon', value === 'true'))}
          allowDeselect={false}
        />

        <Select
          label="Show Gallery Section Labels"
          description="Controls whether gallery section headings render at all for the currently edited gallery mode surface."
          data={[
            { value: 'true', label: 'On' },
            { value: 'false', label: 'Off' },
          ]}
          value={String(getRepresentativeBooleanCommonValue(resolvedDraft, activeBreakpoint, 'showCampaignGalleryLabels') ?? true)}
          onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'showCampaignGalleryLabels', value === 'true'))}
          allowDeselect={false}
        />

        <Divider label="Viewport Backgrounds" labelPosition="center" />

        {getEditableScopes(resolvedDraft.mode ?? 'per-type').map((scope) => {
          const scopeLabel = formatScopeLabel(scope);
          const defaults = getScopeViewportBackgroundFallbacks(scope);
          const bgType = getScopeCommonValue(resolvedDraft, activeBreakpoint, scope, 'viewportBgType') ?? defaults.viewportBgType;
          const bgColor = getScopeCommonValue(resolvedDraft, activeBreakpoint, scope, 'viewportBgColor') ?? defaults.viewportBgColor;
          const bgGradient = getScopeCommonValue(resolvedDraft, activeBreakpoint, scope, 'viewportBgGradient') ?? defaults.viewportBgGradient;
          const bgImageUrl = getScopeCommonValue(resolvedDraft, activeBreakpoint, scope, 'viewportBgImageUrl') ?? defaults.viewportBgImageUrl;

          return (
            <Stack key={scope} gap="sm">
              <Text size="sm" fw={600}>{scopeLabel}</Text>

              <Select
                label={`${scopeLabel} Background`}
                description={`Background applied behind the ${scopeLabel.toLowerCase()} viewport.`}
                data={[
                  { value: 'none', label: 'None' },
                  { value: 'solid', label: 'Solid Color' },
                  { value: 'gradient', label: 'Gradient' },
                  { value: 'image', label: 'Background Image' },
                ]}
                value={bgType}
                onChange={(value) => updateDraft((current) => setCommonSettingForScope(current, activeBreakpoint, scope, 'viewportBgType', value ?? 'none'))}
                allowDeselect={false}
              />

              {bgType === 'solid' && (
                <ColorInput
                  label={`${scopeLabel} Background Color`}
                  description="Solid background color behind the viewport."
                  value={bgColor}
                  onChange={(value) => updateDraft((current) => setCommonSettingForScope(current, activeBreakpoint, scope, 'viewportBgColor', value))}
                />
              )}

              {bgType === 'gradient' && (
                <TextInput
                  label={`${scopeLabel} Background Gradient`}
                  description="CSS gradient string used behind the viewport."
                  value={bgGradient}
                  onChange={(event) => updateDraft((current) => setCommonSettingForScope(
                    current,
                    activeBreakpoint,
                    scope,
                    'viewportBgGradient',
                    event.currentTarget.value,
                  ))}
                />
              )}

              {bgType === 'image' && (
                <TextInput
                  label={`${scopeLabel} Background Image URL`}
                  description="Image shown behind the viewport."
                  value={bgImageUrl}
                  onChange={(event) => updateDraft((current) => setCommonSettingForScope(
                    current,
                    activeBreakpoint,
                    scope,
                    'viewportBgImageUrl',
                    event.currentTarget.value,
                  ))}
                />
              )}
            </Stack>
          );
        })}

        {activeSettingGroups.length > 0 && (
          <>
            <Divider label="Adapter-Specific Settings" labelPosition="center" />
            <Stack gap="md">
              {activeSettingGroups.map((group) => (
                <Stack key={group.group} gap="sm">
                  <Text size="sm" fw={600}>{formatSettingGroupLabel(group.group)}</Text>
                  {group.fields.filter((field) => shouldRenderAdapterSettingField(resolvedDraft, activeBreakpoint, group, field)).map((field) => {
                    const representativeValue = getRepresentativeAdapterSettingValue(resolvedDraft, activeBreakpoint, group, field);

                    if (field.control === 'number') {
                      return (
                        <NumberInput
                          key={String(field.key)}
                          label={field.label}
                          description={field.description}
                          value={typeof representativeValue === 'number' ? representativeValue : field.fallback}
                          onChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                            current,
                            activeBreakpoint,
                            group,
                            field,
                            typeof value === 'number' ? value : field.fallback,
                          ))}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                        />
                      );
                    }

                    if (field.control === 'boolean') {
                      return (
                        <Select
                          key={String(field.key)}
                          label={field.label}
                          description={field.description}
                          data={[
                            { value: 'true', label: 'On' },
                            { value: 'false', label: 'Off' },
                          ]}
                          value={String(typeof representativeValue === 'boolean' ? representativeValue : field.fallback)}
                          onChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                            current,
                            activeBreakpoint,
                            group,
                            field,
                            value === 'true',
                          ))}
                          allowDeselect={false}
                        />
                      );
                    }

                    if (field.control === 'text') {
                      return (
                        <TextInput
                          key={String(field.key)}
                          label={field.label}
                          description={field.description}
                          value={typeof representativeValue === 'string' ? representativeValue : field.fallback}
                          placeholder={field.placeholder}
                          onChange={(event) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                            current,
                            activeBreakpoint,
                            group,
                            field,
                            event.currentTarget.value,
                          ))}
                        />
                      );
                    }

                    if (field.control === 'color') {
                      return (
                        <ColorInput
                          key={String(field.key)}
                          label={field.label}
                          description={field.description}
                          value={typeof representativeValue === 'string' ? representativeValue : field.fallback}
                          onChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                            current,
                            activeBreakpoint,
                            group,
                            field,
                            value,
                          ))}
                        />
                      );
                    }

                    return (
                      <Select
                        key={String(field.key)}
                        label={field.label}
                        description={field.description}
                        data={field.options}
                        value={typeof representativeValue === 'string' ? representativeValue : field.fallback}
                        onChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                          current,
                          activeBreakpoint,
                          group,
                          field,
                          value ?? field.fallback,
                        ))}
                        allowDeselect={false}
                      />
                    );
                  })}
                </Stack>
              ))}
            </Stack>
          </>
        )}

        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm">
            {getEditableScopes(resolvedDraft.mode ?? 'per-type').map((scope) => (
              <Button
                key={scope}
                variant="subtle"
                color="gray"
                onClick={() => updateDraft((current) => resetScopeToBaseline(current, resolvedBaseline, scope))}
              >
                Reset {formatScopeLabel(scope)}
              </Button>
            ))}
            <Button
              variant="subtle"
              color="gray"
              onClick={() => updateDraft((current) => resetBreakpointToBaseline(current, resolvedBaseline, activeBreakpoint))}
            >
              Reset {activeBreakpoint}
            </Button>
            <Button variant="subtle" color="gray" onClick={() => setDraft(baseline)}>
              Reset All Changes
            </Button>
            {(clearMode === 'draft' || onClear) && (
              <Button
                variant="subtle"
                color="red"
                onClick={() => {
                  if (clearMode === 'draft') {
                    setDraft(undefined);
                    return;
                  }

                  onClear?.();
                }}
              >
                {clearLabel}
              </Button>
            )}
          </Group>
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(draft ? pruneConfig(draft) : undefined)}>{saveLabel}</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}