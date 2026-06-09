import { useState, useCallback } from 'react';
import {
  Stack, Group, NumberInput, Switch, Button, Text, Badge, Divider,
  SegmentedControl, Select, Alert, Loader, Center,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@/services/apiClient';
import { ThemeSelector } from './ThemeSelector';

interface SpaceSettingsData {
  theme?: string;
  galleryLayout?: string;
  campaignListingAdapterId?: string;
  itemsPerPage?: number;
  enableLightbox?: boolean;
  enableAnimations?: boolean;
  wpFullBleedDesktop?: boolean;
  wpFullBleedTablet?: boolean;
  wpFullBleedMobile?: boolean;
}

interface SpaceSettingsPanelProps {
  apiClient: ApiClient;
  spaceId: number;
  spaceName: string;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

export function SpaceSettingsPanel({ apiClient, spaceId, spaceName, onNotify }: SpaceSettingsPanelProps) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<SpaceSettingsData | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['space-settings', spaceId],
    queryFn: async () => {
      const res = await apiClient.get<{ settings: SpaceSettingsData; overrides: Record<string, unknown> }>(
        `/wp-json/wp-super-gallery/v1/spaces/${spaceId}/settings`,
      );
      return res;
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const effective = draft ?? data?.settings ?? {};
  const overrides = data?.overrides ?? {};

  const update = useCallback(<K extends keyof SpaceSettingsData>(key: K, value: SpaceSettingsData[K]) => {
    setDraft((prev) => ({ ...(prev ?? {}), [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/spaces/${spaceId}/settings`, draft);
      setDraft(null);
      await refetch();
      onNotify({ type: 'success', text: `Settings saved for ${spaceName}` });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }, [apiClient, draft, spaceId, spaceName, onNotify, refetch]);

  const handleClearOverride = useCallback(async (key: string) => {
    setSaving(true);
    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/spaces/${spaceId}/settings`, { [key]: null });
      setDraft(null);
      await refetch();
      onNotify({ type: 'success', text: 'Override cleared — global default now applies' });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? 'Failed to clear override' });
    } finally {
      setSaving(false);
    }
  }, [apiClient, spaceId, onNotify, refetch]);

  if (isLoading) {
    return <Center py="xl"><Loader size="sm" /></Center>;
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Failed to load settings">
        {(error as Error).message}
      </Alert>
    );
  }

  const isOverridden = (key: string) => key in overrides;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Unset fields inherit global defaults. Set a value to override for this space only.
      </Text>

      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={500}>Theme</Text>
          {isOverridden('theme') && (
            <Badge size="xs" variant="light" color="blue" style={{ cursor: 'pointer' }} onClick={() => void handleClearOverride('theme')}>
              override · clear
            </Badge>
          )}
        </Group>
        <ThemeSelector
          value={effective.theme ?? ''}
          onThemeChange={(id) => update('theme', id)}
          description="Overrides the global theme for this space."
        />
      </Stack>

      <Divider />

      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={500}>Gallery layout</Text>
          {isOverridden('gallery_layout') && (
            <Badge size="xs" variant="light" color="blue" style={{ cursor: 'pointer' }} onClick={() => void handleClearOverride('gallery_layout')}>
              override · clear
            </Badge>
          )}
        </Group>
        <SegmentedControl
          data={[
            { value: 'grid', label: 'Grid' },
            { value: 'masonry', label: 'Masonry' },
            { value: 'slideshow', label: 'Slideshow' },
          ]}
          value={effective.galleryLayout ?? 'grid'}
          onChange={(v) => update('galleryLayout', v)}
          size="xs"
        />
      </Stack>

      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={500}>Listing adapter</Text>
          {isOverridden('campaign_listing_adapter_id') && (
            <Badge size="xs" variant="light" color="blue" style={{ cursor: 'pointer' }} onClick={() => void handleClearOverride('campaignListingAdapterId')}>
              override · clear
            </Badge>
          )}
        </Group>
        <Select
          data={[
            { value: 'compact-grid', label: 'Compact Grid' },
            { value: 'classic', label: 'Classic' },
            { value: 'masonry', label: 'Masonry' },
            { value: 'justified', label: 'Justified' },
            { value: 'carousel', label: 'Carousel' },
            { value: 'layout-builder', label: 'Layout Builder' },
          ]}
          value={effective.campaignListingAdapterId ?? 'compact-grid'}
          onChange={(v) => update('campaignListingAdapterId', v ?? undefined)}
          size="xs"
          w={180}
          allowDeselect={false}
        />
      </Stack>

      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={500}>Items per page</Text>
          {isOverridden('items_per_page') && (
            <Badge size="xs" variant="light" color="blue" style={{ cursor: 'pointer' }} onClick={() => void handleClearOverride('items_per_page')}>
              override · clear
            </Badge>
          )}
        </Group>
        <NumberInput
          value={effective.itemsPerPage ?? 12}
          onChange={(v) => update('itemsPerPage', typeof v === 'number' ? v : undefined)}
          min={1}
          max={100}
          size="xs"
          w={100}
        />
      </Stack>

      <Divider />

      <Stack gap="xs">
        <Text size="sm" fw={500}>Features</Text>
        <Group gap="xl">
          <Switch
            label="Enable lightbox"
            checked={effective.enableLightbox ?? true}
            onChange={(e) => update('enableLightbox', e.currentTarget.checked)}
            size="sm"
          />
          <Switch
            label="Enable animations"
            checked={effective.enableAnimations ?? true}
            onChange={(e) => update('enableAnimations', e.currentTarget.checked)}
            size="sm"
          />
        </Group>
      </Stack>

      <Divider />

      <Stack gap="xs">
        <Text size="sm" fw={500}>Full bleed</Text>
        <Group gap="xl">
          <Switch
            label="Desktop"
            checked={effective.wpFullBleedDesktop ?? false}
            onChange={(e) => update('wpFullBleedDesktop', e.currentTarget.checked)}
            size="sm"
          />
          <Switch
            label="Tablet"
            checked={effective.wpFullBleedTablet ?? false}
            onChange={(e) => update('wpFullBleedTablet', e.currentTarget.checked)}
            size="sm"
          />
          <Switch
            label="Mobile"
            checked={effective.wpFullBleedMobile ?? false}
            onChange={(e) => update('wpFullBleedMobile', e.currentTarget.checked)}
            size="sm"
          />
        </Group>
      </Stack>

      <Group justify="flex-end" mt="sm">
        <Button
          leftSection={<IconCheck size={14} />}
          onClick={() => void handleSave()}
          loading={saving}
          disabled={!draft}
          size="sm"
        >
          Save space settings
        </Button>
      </Group>
    </Stack>
  );
}
