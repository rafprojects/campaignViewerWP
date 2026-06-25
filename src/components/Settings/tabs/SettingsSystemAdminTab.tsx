import { memo, type ReactNode } from 'react';
import { Paper, Select, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@/services/apiClient';
import type { SettingsData } from '@/contexts/SettingsStore';
import type { UpdateGallerySetting } from '../GalleryAdapterSettingsSection';
import { AdvancedSettingsSection } from '../AdvancedSettingsSection';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

function MagicLinkPageSelector({
  apiClient,
  value,
  onChange,
}: {
  apiClient: ApiClient;
  value: number;
  onChange: (id: number) => void;
}) {
  const { data: pages, isLoading } = useQuery({
    queryKey: ['wpPages', apiClient.getBaseUrl()],
    queryFn: () => apiClient.listWpPages(),
    staleTime: 5 * 60 * 1000,
  });

  const selectData = [
    { value: '0', label: '— None (use inline HTML fallback) —' },
    ...(pages ?? []).map((p) => ({
      value: String(p.id),
      label: p.title.rendered || `Page #${p.id}`,
    })),
  ];

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Text size="sm" fw={600}>Access Request Magic-Link</Text>
        <Text size="xs" c="dimmed">
          When an admin clicks a one-click approval link, the result is shown on this page
          (via <code>?wpsg_result=approved|expired|used|invalid</code>). If no page is selected,
          a minimal inline HTML page is returned instead.
        </Text>
        <Select
          label="Magic-link landing page"
          placeholder={isLoading ? 'Loading pages…' : 'Select a page'}
          data={selectData}
          value={String(value)}
          onChange={(v) => onChange(v ? parseInt(v, 10) : 0)}
          disabled={isLoading}
          searchable
          clearable={false}
          size="sm"
        />
      </Stack>
    </Paper>
  );
}

interface SettingsSystemAdminTabProps {
  settings: SettingsData;
  updateSetting: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
  updateGallerySetting: UpdateGallerySetting;
  apiClient: ApiClient;
  tooltipLabel: (label: string, key: string) => ReactNode;
}

// P57-A: The System & Admin tab holds global (non-space-overridable) settings.
// It renders in space-scoped panels too; the backend split-saves these keys to
// the global option (see update_space_settings), so editing them from any panel
// persists globally.
export const SettingsSystemAdminTab = memo(function SettingsSystemAdminTab({
  settings,
  updateSetting,
  updateGallerySetting,
  apiClient,
  tooltipLabel,
}: SettingsSystemAdminTabProps) {
  return (
    <Stack gap="xl">
      <MagicLinkPageSelector
        apiClient={apiClient}
        value={settings.magicLinkLandingPageId ?? 0}
        onChange={(id) => updateSetting('magicLinkLandingPageId', id)}
      />
      <AdvancedSettingsSection
        settings={settings}
        updateSetting={updateGallerySetting}
        tooltipLabel={tooltipLabel}
        apiClient={apiClient}
      />
    </Stack>
  );
});
setWpsgDebugDisplayName(SettingsSystemAdminTab, 'SettingsPanel:SystemAdminTab');
