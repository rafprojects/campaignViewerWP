import { memo } from 'react';
import type { ApiClient } from '@/services/apiClient';
import { WebhookSettingsSection } from '../WebhookSettingsSection';
import { setMullionDebugDisplayName } from '@/utils/mullionDebug';

interface SettingsIntegrationsTabProps {
  apiClient: ApiClient;
}

export const SettingsIntegrationsTab = memo(function SettingsIntegrationsTab({
  apiClient,
}: SettingsIntegrationsTabProps) {
  return <WebhookSettingsSection apiClient={apiClient} />;
});
setMullionDebugDisplayName(SettingsIntegrationsTab, 'SettingsPanel:IntegrationsTab');
