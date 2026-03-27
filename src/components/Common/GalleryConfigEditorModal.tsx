import { Button, Divider, Group, Modal, NumberInput, Select, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

import {
  adapterUsesSettingGroup,
  getActiveSettingGroupDefinitions,
  getAdapterSelectOptions,
} from '@/components/Galleries/Adapters/adapterRegistry';
import type {
  AdapterSettingFieldDefinition,
  AdapterSettingGroupDefinition,
  AdapterSettingGroupScopeMode,
} from '@/components/Galleries/Adapters/GalleryAdapter';
import type { GalleryCommonSettings, GalleryConfig, GalleryConfigBreakpoint, GalleryConfigMode, GalleryConfigScope } from '@/types';
import { cloneGalleryConfig } from '@/utils/galleryConfig';

const GALLERY_BREAKPOINTS: GalleryConfigBreakpoint[] = ['desktop', 'tablet', 'mobile'];

interface GalleryConfigEditorModalProps {
  opened: boolean;
  title: string;
  value?: Partial<GalleryConfig>;
  onClose: () => void;
  onSave: (value: GalleryConfig) => void;
  onClear?: () => void;
  contextSummary?: string;
  saveLabel?: string;
  clearLabel?: string;
  unifiedAdapterEnabled?: boolean;
  unifiedAdapterDescription?: string;
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
  | 'galleryImageLabel'
  | 'galleryVideoLabel'
  | 'galleryLabelJustification'
  | 'showGalleryLabelIcon'
  | 'showCampaignGalleryLabels'
>;

function getScopeAdapterId(
  config: Partial<GalleryConfig> | undefined,
  breakpoint: GalleryConfigBreakpoint,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
): string {
  return config?.breakpoints?.[breakpoint]?.[scope]?.adapterId ?? '';
}

function getEditableScopes(mode: GalleryConfigMode): Array<Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>> {
  return mode === 'unified' ? ['unified'] : ['image', 'video'];
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
  key: Extract<SharedCommonSettingKey, 'sectionHeightMode' | 'adapterSizingMode' | 'adapterJustifyContent' | 'galleryImageLabel' | 'galleryVideoLabel' | 'galleryLabelJustification'>,
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
): number | string | undefined {
  const scopes = getApplicableScopes(config?.mode ?? 'per-type', group.scopeMode ?? 'shared', field);

  for (const scope of scopes) {
    const scopeConfig = config?.breakpoints?.[breakpoint]?.[scope];
    if (!adapterUsesSettingGroup(scopeConfig?.adapterId, group.group)) {
      continue;
    }

    const value = scopeConfig?.adapterSettings?.[field.key];
    if ((field.control === 'number' && typeof value === 'number') || (field.control === 'select' && typeof value === 'string')) {
      return value;
    }
  }

  return undefined;
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
  key: SharedCommonSettingKey,
  value: number | string | boolean,
): GalleryConfig {
  const next = cloneGalleryConfig(config) ?? { mode: config.mode ?? 'per-type', breakpoints: {} };
  next.breakpoints = next.breakpoints ?? {};

  GALLERY_BREAKPOINTS.forEach((breakpoint) => {
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

    next.breakpoints![breakpoint] = breakpointConfig;
  });

  return pruneConfig({
    mode: next.mode ?? 'per-type',
    breakpoints: next.breakpoints,
  });
}

function getApplicableScopes(
  mode: GalleryConfigMode,
  scopeMode: AdapterSettingGroupScopeMode,
  field: AdapterSettingFieldDefinition,
): Array<Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>> {
  const editableScopes = getEditableScopes(mode);
  const appliesTo = field.appliesTo ?? 'always';

  if (scopeMode === 'contextual' && appliesTo !== 'always') {
    return editableScopes.filter((scope) => scope === appliesTo);
  }

  if (appliesTo === 'always') {
    return editableScopes;
  }

  return editableScopes.filter((scope) => scope === appliesTo);
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

function formatSettingGroupLabel(group: AdapterSettingGroupDefinition['group']): string {
  switch (group) {
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
  value: number | string,
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

export function GalleryConfigEditorModal({
  opened,
  title,
  value,
  onClose,
  onSave,
  onClear,
  contextSummary,
  saveLabel = 'Apply Gallery Config',
  clearLabel = 'Clear Overrides',
  unifiedAdapterEnabled = true,
  unifiedAdapterDescription,
}: GalleryConfigEditorModalProps) {
  const [draft, setDraft] = useState<GalleryConfig>({ mode: 'per-type', breakpoints: {} });
  const [baseline, setBaseline] = useState<GalleryConfig>({ mode: 'per-type', breakpoints: {} });
  const [activeBreakpoint, setActiveBreakpoint] = useState<GalleryConfigBreakpoint>('desktop');
  const activeSettingGroups = getActiveSettingGroupDefinitions(
    getEditableScopes(draft.mode ?? 'per-type').map((scope) => draft.breakpoints?.[activeBreakpoint]?.[scope]?.adapterId),
  ).filter((group) => group.fields.some((field) => hasVisibleAdapterSettingField(draft, activeBreakpoint, group, field)));

  useEffect(() => {
    if (!opened) {
      return;
    }

    const nextBaseline = pruneConfig(cloneGalleryConfig(value as GalleryConfig) ?? { mode: 'per-type', breakpoints: {} });
    setBaseline(nextBaseline);
    setDraft(nextBaseline);
    setActiveBreakpoint('desktop');
  }, [opened, value]);

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg" centered>
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
          value={draft.mode ?? 'per-type'}
          onChange={(nextMode) => {
            if (nextMode === 'unified' || nextMode === 'per-type') {
              setDraft((current) => setConfigMode(current, nextMode));
            }
          }}
        />

        {draft.mode === 'unified' ? (
          unifiedAdapterEnabled ? (
            <Select
              label="Unified Gallery Adapter"
              description={unifiedAdapterDescription ?? 'Adapter applied when images and videos render together.'}
              data={getAdapterSelectOptions({ context: 'unified-gallery' })}
              value={getScopeAdapterId(draft, 'desktop', 'unified') || null}
              onChange={(adapterId) => {
                const nextId = adapterId ?? '';
                setDraft((current) => {
                  let next = current;
                  GALLERY_BREAKPOINTS.forEach((breakpoint) => {
                    next = setScopeAdapterId(next, breakpoint, 'unified', nextId);
                  });
                  return next;
                });
              }}
              clearable
              placeholder="Default adapter"
            />
          ) : (
            <Text size="sm" c="dimmed">
              Unified mode selection is supported here, but campaign-level unified adapter overrides still inherit the global unified adapter in this slice.
            </Text>
          )
        ) : (
          <Tabs value={activeBreakpoint} onChange={(value) => value && setActiveBreakpoint(value as GalleryConfigBreakpoint)}>
            <Tabs.List grow>
              {GALLERY_BREAKPOINTS.map((breakpoint) => (
                <Tabs.Tab key={breakpoint} value={breakpoint}>
                  {breakpoint.charAt(0).toUpperCase() + breakpoint.slice(1)}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {GALLERY_BREAKPOINTS.map((breakpoint) => {
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
                      value={getScopeAdapterId(draft, breakpoint, 'image') || null}
                      onChange={(adapterId) => setDraft((current) => setScopeAdapterId(current, breakpoint, 'image', adapterId ?? ''))}
                      clearable
                      placeholder="Default adapter"
                    />
                    <Select
                      label="Video Adapter"
                      description={`Video gallery adapter for the ${breakpoint} breakpoint.`}
                      data={adapterOptions}
                      value={getScopeAdapterId(draft, breakpoint, 'video') || null}
                      onChange={(adapterId) => setDraft((current) => setScopeAdapterId(current, breakpoint, 'video', adapterId ?? ''))}
                      clearable
                      placeholder="Default adapter"
                    />
                  </Stack>
                </Tabs.Panel>
              );
            })}
          </Tabs>
        )}

        <Divider label="Shared Section Sizing" labelPosition="center" />

        <NumberInput
          label="Gallery Section Max Width (px)"
          description="Maximum width for each gallery section. 0 keeps the section fully responsive."
          value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'sectionMaxWidth') ?? 0}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'sectionMaxWidth', typeof value === 'number' ? value : 0))}
          min={0}
          max={2000}
          step={50}
        />

        <NumberInput
          label="Gallery Section Min Width (px)"
          description="Minimum width floor for each gallery section."
          value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'sectionMinWidth') ?? 300}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'sectionMinWidth', typeof value === 'number' ? value : 300))}
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
          value={getRepresentativeStringCommonValue(draft, activeBreakpoint, 'sectionHeightMode') ?? 'auto'}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'sectionHeightMode', value ?? 'auto'))}
          allowDeselect={false}
        />

        {getRepresentativeStringCommonValue(draft, activeBreakpoint, 'sectionHeightMode') === 'manual' && (
          <NumberInput
            label="Gallery Section Max Height (px)"
            description="Maximum height used when section height mode is manual."
            value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'sectionMaxHeight') ?? 0}
            onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'sectionMaxHeight', typeof value === 'number' ? value : 0))}
            min={0}
            max={2000}
            step={50}
          />
        )}

        <NumberInput
          label="Gallery Section Min Height (px)"
          description="Minimum height floor for each gallery section."
          value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'sectionMinHeight') ?? 150}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'sectionMinHeight', typeof value === 'number' ? value : 150))}
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
          value={String(getRepresentativeBooleanCommonValue(draft, activeBreakpoint, 'perTypeSectionEqualHeight') ?? false)}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'perTypeSectionEqualHeight', value === 'true'))}
          allowDeselect={false}
        />

        <Divider label="Shared Section Spacing" labelPosition="center" />

        <NumberInput
          label="Section Padding (px)"
          description="Applies the same inner section padding across the currently edited gallery mode surface."
          value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'sectionPadding') ?? 16}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'sectionPadding', typeof value === 'number' ? value : 16))}
          min={0}
          max={32}
          step={4}
        />

        <NumberInput
          label="Adapter Content Padding (px)"
          description="Applies the same inner adapter padding across the currently edited gallery mode surface."
          value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'adapterContentPadding') ?? 0}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'adapterContentPadding', typeof value === 'number' ? value : 0))}
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
          value={getRepresentativeStringCommonValue(draft, activeBreakpoint, 'adapterSizingMode') ?? 'fill'}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'adapterSizingMode', value ?? 'fill'))}
          allowDeselect={false}
        />

        {getRepresentativeStringCommonValue(draft, activeBreakpoint, 'adapterSizingMode') === 'manual' && (
          <>
            <NumberInput
              label="Adapter Max Width (%)"
              description="Maximum adapter width as a percentage of its gallery section."
              value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'adapterMaxWidthPct') ?? 100}
              onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'adapterMaxWidthPct', typeof value === 'number' ? value : 100))}
              min={50}
              max={100}
              step={5}
            />

            <NumberInput
              label="Adapter Max Height (%)"
              description="Maximum adapter height as a percentage of its gallery section."
              value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'adapterMaxHeightPct') ?? 100}
              onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'adapterMaxHeightPct', typeof value === 'number' ? value : 100))}
              min={50}
              max={100}
              step={5}
            />
          </>
        )}

        <NumberInput
          label="Adapter Item Gap (px)"
          description="Applies shared item spacing across the currently edited gallery mode surface."
          value={getRepresentativeNumberCommonValue(draft, activeBreakpoint, 'adapterItemGap') ?? 16}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'adapterItemGap', typeof value === 'number' ? value : 16))}
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
          value={getRepresentativeStringCommonValue(draft, activeBreakpoint, 'adapterJustifyContent') ?? 'center'}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'adapterJustifyContent', value ?? 'center'))}
          allowDeselect={false}
        />

        <Divider label="Shared Gallery Presentation" labelPosition="center" />

        <TextInput
          label="Image Gallery Label"
          description="Shared heading text for image gallery sections when labels are enabled."
          value={getRepresentativeStringCommonValue(draft, activeBreakpoint, 'galleryImageLabel') ?? 'Images'}
          onChange={(event) => setDraft((current) => setCommonSettingForEditableScopes(current, 'galleryImageLabel', event.currentTarget.value))}
        />

        <TextInput
          label="Video Gallery Label"
          description="Shared heading text for video gallery sections when labels are enabled."
          value={getRepresentativeStringCommonValue(draft, activeBreakpoint, 'galleryVideoLabel') ?? 'Videos'}
          onChange={(event) => setDraft((current) => setCommonSettingForEditableScopes(current, 'galleryVideoLabel', event.currentTarget.value))}
        />

        <Select
          label="Gallery Label Justification"
          description="Controls how gallery section titles align across the currently edited gallery mode surface."
          data={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          value={getRepresentativeStringCommonValue(draft, activeBreakpoint, 'galleryLabelJustification') ?? 'left'}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'galleryLabelJustification', value ?? 'left'))}
          allowDeselect={false}
        />

        <Select
          label="Show Gallery Label Icons"
          description="Displays the adapter icon beside gallery section titles."
          data={[
            { value: 'true', label: 'On' },
            { value: 'false', label: 'Off' },
          ]}
          value={String(getRepresentativeBooleanCommonValue(draft, activeBreakpoint, 'showGalleryLabelIcon') ?? false)}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'showGalleryLabelIcon', value === 'true'))}
          allowDeselect={false}
        />

        <Select
          label="Show Gallery Section Labels"
          description="Controls whether gallery section headings render at all for the currently edited gallery mode surface."
          data={[
            { value: 'true', label: 'On' },
            { value: 'false', label: 'Off' },
          ]}
          value={String(getRepresentativeBooleanCommonValue(draft, activeBreakpoint, 'showCampaignGalleryLabels') ?? true)}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'showCampaignGalleryLabels', value === 'true'))}
          allowDeselect={false}
        />

        {activeSettingGroups.length > 0 && (
          <>
            <Divider label="Adapter-Specific Settings" labelPosition="center" />
            <Stack gap="md">
              {activeSettingGroups.map((group) => (
                <Stack key={group.group} gap="sm">
                  <Text size="sm" fw={600}>{formatSettingGroupLabel(group.group)}</Text>
                  {group.fields.filter((field) => hasVisibleAdapterSettingField(draft, activeBreakpoint, group, field)).map((field) => {
                    const representativeValue = getRepresentativeAdapterSettingValue(draft, activeBreakpoint, group, field);

                    if (field.control === 'number') {
                      return (
                        <NumberInput
                          key={String(field.key)}
                          label={field.label}
                          description={field.description}
                          value={typeof representativeValue === 'number' ? representativeValue : field.fallback}
                          onChange={(value) => setDraft((current) => setAdapterSettingForMatchingScopes(
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

                    return (
                      <Select
                        key={String(field.key)}
                        label={field.label}
                        description={field.description}
                        data={field.options}
                        value={typeof representativeValue === 'string' ? representativeValue : field.fallback}
                        onChange={(value) => setDraft((current) => setAdapterSettingForMatchingScopes(
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
            {draft.mode === 'per-type' && (
              <Button
                variant="subtle"
                color="gray"
                onClick={() => setDraft((current) => resetBreakpointToBaseline(current, baseline, activeBreakpoint))}
              >
                Reset {activeBreakpoint}
              </Button>
            )}
            <Button variant="subtle" color="gray" onClick={() => setDraft(baseline)}>
              Reset All Changes
            </Button>
            {onClear && (
              <Button variant="subtle" color="red" onClick={onClear}>
                {clearLabel}
              </Button>
            )}
          </Group>
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(pruneConfig(draft))}>{saveLabel}</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}