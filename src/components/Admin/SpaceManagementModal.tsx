import { Modal, Group, Text } from '@mantine/core';
import { IconStack2 } from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import { SpaceManagementView } from './SpaceManagementView';

interface SpaceManagementModalProps {
  opened: boolean;
  apiClient: ApiClient;
  onClose: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  onSpacesChanged: () => void;
}

export function SpaceManagementModal({ opened, apiClient, onClose, onNotify, onSpacesChanged }: SpaceManagementModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Group gap="xs"><IconStack2 size={16} /><Text fw={600}>Manage spaces</Text></Group>}
      size="lg"
      centered
    >
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />
    </Modal>
  );
}
