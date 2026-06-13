import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Select,
  Text,
  Alert,
} from '@mantine/core';
import { IconArrowsExchange, IconInfoCircle } from '@tabler/icons-react';
import type { AdminCampaign, SpaceInfo } from '@/services/adminQuery';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface CampaignMoveSpaceModalProps {
  /** Campaign to move; null when modal is closed. */
  source: AdminCampaign | null;
  /** Space the campaign currently belongs to. */
  sourceSpace: SpaceInfo | null;
  /** All spaces visible to the user; the modal filters to movable targets. */
  spaces: SpaceInfo[];
  isSaving: boolean;
  onConfirm: (targetSpaceId: number, targetSpaceName: string) => void;
  onClose: () => void;
}

/**
 * P50-A: Confirmation dialog for moving a campaign to another space.
 * Targets are limited to active spaces the user owns, excluding the source.
 */
export function CampaignMoveSpaceModal({
  source,
  sourceSpace,
  spaces,
  isSaving,
  onConfirm,
  onClose,
}: CampaignMoveSpaceModalProps) {
  const [targetId, setTargetId] = useState<string | null>(null);

  const targetOptions = useMemo(
    () => spaces
      .filter((s) => !s.archived && s.effectiveLevel === 'owner' && s.id !== sourceSpace?.id)
      .map((s) => ({ value: String(s.id), label: s.name })),
    [spaces, sourceSpace],
  );

  // Reset the selection whenever a new campaign is staged.
  useEffect(() => {
    if (source) setTargetId(null);
  }, [source]);

  const handleConfirm = () => {
    const id = Number(targetId);
    if (!id) return;
    const target = spaces.find((s) => s.id === id);
    onConfirm(id, target?.name ?? `space ${id}`);
  };

  return (
    <Modal
      {...getWpsgDebugProps('CampaignMoveSpaceModal')}
      opened={source !== null}
      onClose={onClose}
      title={<span {...getWpsgDebugProps('CampaignMoveSpaceModal', 'title')}>Move Campaign to Space</span>}
      size="sm"
      aria-label="Move campaign to space"
      closeButtonProps={getWpsgDebugProps('CampaignMoveSpaceModal', 'close')}
      overlayProps={getWpsgDebugProps('CampaignMoveSpaceModal', 'overlay')}
    >
      <Stack {...getWpsgDebugProps('CampaignMoveSpaceModal', 'stack')} gap="md">
        <div>
          <Text size="sm" c="dimmed" mb={4}>Campaign:</Text>
          <Text fw={600}>{source?.title}</Text>
          <Text size="sm" c="dimmed" mt={4}>
            From space: <Text component="span" fw={600} c="inherit">{sourceSpace?.name ?? '—'}</Text>
          </Text>
        </div>

        <Select
          label="Target space"
          placeholder={targetOptions.length > 0 ? 'Pick a space' : 'No other spaces you own'}
          data={targetOptions}
          value={targetId}
          onChange={setTargetId}
          disabled={targetOptions.length === 0}
          searchable
          data-autofocus
        />

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          All analytics, audit history, media references, and access requests
          move with the campaign. The source space will no longer list it.
        </Alert>

        <Group {...getWpsgDebugProps('CampaignMoveSpaceModal', 'actions')} justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            leftSection={<IconArrowsExchange size={16} />}
            onClick={handleConfirm}
            loading={isSaving}
            disabled={!targetId}
          >
            Move
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(CampaignMoveSpaceModal, 'AdminPanel:CampaignMoveSpaceModal');
