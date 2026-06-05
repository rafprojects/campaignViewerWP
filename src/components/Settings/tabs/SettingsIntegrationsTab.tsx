import { memo } from 'react';
import type { ApiClient } from '@/services/apiClient';
import { WebhookSettingsSection } from '../WebhookSettingsSection';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface SettingsIntegrationsTabProps {
  apiClient: ApiClient;
}

export const SettingsIntegrationsTab = memo(function SettingsIntegrationsTab({
  apiClient,
}: SettingsIntegrationsTabProps) {
  return <WebhookSettingsSection apiClient={apiClient} />;
});
setWpsgDebugDisplayName(SettingsIntegrationsTab, 'SettingsPanel:IntegrationsTab');
