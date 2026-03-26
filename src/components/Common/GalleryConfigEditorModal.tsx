import { Button, Divider, Group, Modal, NumberInput, Select, Stack, Tabs, Text } from '@mantine/core';
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
import type { GalleryConfig, GalleryConfigBreakpoint, GalleryConfigMode, GalleryConfigScope } from '@/types';
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
  key: 'sectionPadding' | 'adapterContentPadding',
): number | undefined {
  const scopes = getEditableScopes(config?.mode ?? 'per-type');

  for (const scope of scopes) {
    const value = config?.breakpoints?.[breakpoint]?.[scope]?.common?.[key];
    if (typeof value === 'number') {
      return value;
    }
  }

  return undefined;
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
  key: 'sectionPadding' | 'adapterContentPadding',
  value: number,
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

        <Divider label="Shared Section Spacing" labelPosition="center" />

        <NumberInput
          label="Section Padding (px)"
          description="Applies the same inner section padding across the currently edited gallery mode surface."
          value={getRepresentativeCommonValue(draft, activeBreakpoint, 'sectionPadding') ?? 16}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'sectionPadding', typeof value === 'number' ? value : 16))}
          min={0}
          max={32}
          step={4}
        />

        <NumberInput
          label="Adapter Content Padding (px)"
          description="Applies the same inner adapter padding across the currently edited gallery mode surface."
          value={getRepresentativeCommonValue(draft, activeBreakpoint, 'adapterContentPadding') ?? 0}
          onChange={(value) => setDraft((current) => setCommonSettingForEditableScopes(current, 'adapterContentPadding', typeof value === 'number' ? value : 0))}
          min={0}
          max={24}
          step={4}
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