import { Button, Group, Modal, Select, Stack, Tabs, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

import { getAdapterSelectOptions } from '@/components/Galleries/Adapters/adapterRegistry';
import type { GalleryConfig, GalleryConfigBreakpoint, GalleryConfigMode, GalleryConfigScope } from '@/types';
import { cloneGalleryConfig } from '@/utils/galleryConfig';

const GALLERY_BREAKPOINTS: GalleryConfigBreakpoint[] = ['desktop', 'tablet', 'mobile'];

interface GalleryConfigEditorModalProps {
  opened: boolean;
  title: string;
  value?: Partial<GalleryConfig>;
  onClose: () => void;
  onSave: (value: GalleryConfig) => void;
  saveLabel?: string;
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

export function GalleryConfigEditorModal({
  opened,
  title,
  value,
  onClose,
  onSave,
  saveLabel = 'Apply Gallery Config',
  unifiedAdapterEnabled = true,
  unifiedAdapterDescription,
}: GalleryConfigEditorModalProps) {
  const [draft, setDraft] = useState<GalleryConfig>({ mode: 'per-type', breakpoints: {} });
  const [activeBreakpoint, setActiveBreakpoint] = useState<GalleryConfigBreakpoint>('desktop');

  useEffect(() => {
    if (!opened) {
      return;
    }

    setDraft(pruneConfig(cloneGalleryConfig(value as GalleryConfig) ?? { mode: 'per-type', breakpoints: {} }));
    setActiveBreakpoint('desktop');
  }, [opened, value]);

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          This shared editor owns the nested gallery selection model. Inline selectors remain available for quick scanning and small edits.
        </Text>

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

        <Group justify="space-between">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(pruneConfig(draft))}>{saveLabel}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}