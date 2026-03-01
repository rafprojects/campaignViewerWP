import { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  TextInput,
  Text,
  Switch,
  Divider,
} from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import type { AdminCampaign } from '@/hooks/useAdminSWR';

export interface CampaignDuplicateModalProps {
  /** Source campaign to duplicate; null when modal is closed. */
  source: AdminCampaign | null;
  isSaving: boolean;
  onConfirm: (name: string, copyMedia: boolean) => void;
  onClose: () => void;
}

export function CampaignDuplicateModal({
  source,
  isSaving,
  onConfirm,
  onClose,
}: CampaignDuplicateModalProps) {
  const [name, setName] = useState('');
  const [copyMedia, setCopyMedia] = useState(true);

  // Reset state whenever a new source is shown
  useEffect(() => {
    if (source) {
      setName(`${source.title} (Copy)`);
      setCopyMedia(true);
    }
  }, [source]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, copyMedia);
  };

  return (
    <Modal
      opened={source !== null}
      onClose={onClose}
      title="Duplicate Campaign"
      size="sm"
      aria-label="Duplicate campaign"
    >
      <Stack gap="md">
        <div>
          <Text size="sm" c="dimmed" mb={4}>
            Source:
          </Text>
          <Text fw={600}>{source?.title}</Text>
        </div>

        <TextInput
          label="New name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Campaign name"
          data-autofocus
          required
        />

        <Divider />

        <Stack gap="xs">
          <Switch
            label="Copy media associations"
            description="Media items will appear in both campaigns"
            checked={copyMedia}
            onChange={(e) => setCopyMedia(e.currentTarget.checked)}
          />
          {!copyMedia && (
            <Text size="xs" c="dimmed">
              The duplicate will start with an empty media library.
            </Text>
          )}
        </Stack>

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            leftSection={<IconCopy size={16} />}
            onClick={handleConfirm}
            loading={isSaving}
            disabled={!name.trim()}
          >
            Duplicate
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
