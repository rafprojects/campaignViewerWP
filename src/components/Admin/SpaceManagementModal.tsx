import { Modal, Group, Text } from '@mantine/core';
import { IconStack2 } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';
import { SpaceManagementView } from './SpaceManagementView';

interface SpaceManagementModalProps {
  opened: boolean;
  apiClient: ApiClient;
  onClose: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  onSpacesChanged: () => void;
  /** P53-A: gates the create-space form (system-admin only). */
  isSystemAdmin?: boolean;
}

export function SpaceManagementModal({ opened, apiClient, onClose, onNotify, onSpacesChanged, isSystemAdmin = false }: SpaceManagementModalProps) {
  const { t } = useTranslation('wpsg');
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Group gap="xs"><IconStack2 size={16} /><Text fw={600}>{t('admin_space_modal_title', 'Manage spaces')}</Text></Group>}
      size="lg"
      centered
    >
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
        isSystemAdmin={isSystemAdmin}
      />
    </Modal>
  );
}
