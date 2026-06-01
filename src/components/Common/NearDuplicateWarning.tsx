import { Button, Group, Image, Modal, Stack, Text, Badge } from '@mantine/core';
import type { UploadDuplicateCampaign } from '@/types';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface NearDuplicateWarningProps {
  opened: boolean;
  /** Filename of the file being uploaded (the new one). */
  filename: string;
  /** URL of the matching existing image (for the thumbnail). */
  similarUrl: string;
  similarId: number;
  /** Filename of the matching existing image. */
  originalName: string;
  distance: number;
  campaigns: UploadDuplicateCampaign[];
  onUseExisting: () => void;
  onUploadAnyway: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

function formatCampaignLine(campaigns: UploadDuplicateCampaign[]): string {
  if (campaigns.length === 0) return 'Not in any campaign';
  if (campaigns.length === 1) return `Used in: ${campaigns[0]!.title}`;
  if (campaigns.length === 2) return `Used in: ${campaigns[0]!.title}, ${campaigns[1]!.title}`;
  const rest = campaigns.length - 2;
  return `Used in: ${campaigns[0]!.title}, ${campaigns[1]!.title} and ${rest} more`;
}

export function NearDuplicateWarning({
  opened,
  filename,
  similarUrl,
  similarId: _similarId,
  originalName,
  distance,
  campaigns,
  onUseExisting,
  onUploadAnyway,
  onDismiss,
  loading = false,
}: NearDuplicateWarningProps) {
  return (
    <Modal
      {...getWpsgDebugProps('NearDuplicateWarning')}
      opened={opened}
      onClose={onDismiss}
      withinPortal={false}
      title={<span {...getWpsgDebugProps('NearDuplicateWarning', 'title')}>Visually similar image found</span>}
      closeButtonProps={getWpsgDebugProps('NearDuplicateWarning', 'close')}
      overlayProps={getWpsgDebugProps('NearDuplicateWarning', 'overlay')}
      padding="md"
    >
      <Stack {...getWpsgDebugProps('NearDuplicateWarning', 'stack')}>
        <Text size="sm">
          <strong>{filename}</strong> looks like an image already in your library.
        </Text>

        <Group align="flex-start" gap="md">
          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" c="dimmed">Existing image</Text>
            <Image
              {...getWpsgDebugProps('NearDuplicateWarning', 'similar-image')}
              src={similarUrl}
              alt="Similar existing image"
              fit="contain"
              h={120}
              radius="sm"
              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23eee'/%3E%3C/svg%3E"
            />
            <Stack gap={2}>
              {originalName ? (
                <Text size="xs" c="dimmed">
                  <strong>Original:</strong> {originalName}
                </Text>
              ) : null}
              <Text
                {...getWpsgDebugProps('NearDuplicateWarning', 'campaign-line')}
                size="xs"
                c="dimmed"
              >
                {formatCampaignLine(campaigns)}
              </Text>
              <Badge
                {...getWpsgDebugProps('NearDuplicateWarning', 'distance-badge')}
                variant="light"
                color="orange"
                size="sm"
              >
                {distance === 0 ? 'Identical content' : `${distance}/64 bits different`}
              </Badge>
            </Stack>
          </Stack>
        </Group>

        <Text size="xs" c="dimmed">
          Use the existing image to avoid duplicates, or upload this file anyway.
        </Text>

        <Group {...getWpsgDebugProps('NearDuplicateWarning', 'actions')} justify="flex-end">
          <Button variant="default" onClick={onDismiss}>Cancel</Button>
          <Button
            {...getWpsgDebugProps('NearDuplicateWarning', 'use-existing')}
            variant="light"
            onClick={onUseExisting}
            loading={loading}
          >
            Use existing
          </Button>
          <Button
            {...getWpsgDebugProps('NearDuplicateWarning', 'upload-anyway')}
            onClick={onUploadAnyway}
            loading={loading}
          >
            Upload anyway
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(NearDuplicateWarning, 'NearDuplicateWarning');
