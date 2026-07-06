import { memo, type ReactNode } from 'react';
import { Paper, Select, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('wpsg');
  const { data: pages, isLoading } = useQuery({
    queryKey: ['wpPages', apiClient.getBaseUrl()],
    queryFn: () => apiClient.listWpPages(),
    staleTime: 5 * 60 * 1000,
  });

  const selectData = [
    { value: '0', label: t('set_sys_magic_none', '— None (use inline HTML fallback) —') },
    ...(pages ?? []).map((p) => ({
      value: String(p.id),
      label: p.title.rendered || t('set_sys_page_fallback', 'Page #{{id}}', { id: p.id }),
    })),
  ];

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Text size="sm" fw={600}>{t('set_sys_magic_title', 'Access Request Magic-Link')}</Text>
        <Text size="xs" c="dimmed">
          {t('set_sys_magic_desc_pre', 'When an admin clicks a one-click approval link, the result is shown on this page (via ')}
          {/* eslint-disable-next-line i18next/no-literal-string -- literal URL query-string token (not translatable prose); same precedent as P60-I taxonomy tree-indent glyph */}
          <code>?wpsg_result=approved|expired|used|invalid</code>
          {t('set_sys_magic_desc_post', '). If no page is selected, a minimal inline HTML page is returned instead.')}
        </Text>
        <Select
          label={t('set_sys_magic_label', 'Magic-link landing page')}
          placeholder={isLoading ? t('set_sys_loading_pages', 'Loading pages…') : t('set_sys_select_page', 'Select a page')}
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
