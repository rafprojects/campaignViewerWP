/**
 * P18-G: MediaUsageBadge
 *
 * Displays a badge showing how many campaigns reference a given media item.
 * Clicking the badge opens a Popover that lazily fetches the full list of
 * campaign names. A count of 0 is highlighted in red (orphaned media).
 */
import { useState } from 'react';
import { Badge, Popover, Stack, Text, Anchor, Loader, Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import type { MediaUsageCampaignRef } from '@/services/apiClient';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface MediaUsageBadgeProps {
  /** Count already known from the batch summary call in MediaTab. */
  count: number;
  mediaId: string;
  apiClient: ApiClient;
}

interface MediaUsageBadgeContentProps {
  loading: boolean;
  error: string | null;
  detail: MediaUsageCampaignRef[] | null;
}

function MediaUsageBadgeContent({ loading, error, detail }: MediaUsageBadgeContentProps) {
  if (loading) {
    return (
      <Stack {...getWpsgDebugProps('MediaUsageBadge', 'loading')} align="center" py="xs">
        <Loader size="xs" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconInfoCircle size={14} />} py="xs">
        {error}
      </Alert>
    );
  }

  if (detail === null) {
    return null;
  }

  return (
    <Stack {...getWpsgDebugProps('MediaUsageBadge', 'detail')} gap="xs">
      {detail.length === 0 ? (
        <Text size="sm" c="dimmed">
          Not used in any campaign.
        </Text>
      ) : (
        <>
          <Text size="xs" fw={600} c="dimmed">
            Used in campaigns:
          </Text>
          {detail.map((campaign) => (
            <Anchor
              key={campaign.id}
              size="sm"
              href={`?campaign=${campaign.id}`}
              onClick={(e) => e.preventDefault()}
            >
              {campaign.title}
            </Anchor>
          ))}
        </>
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(MediaUsageBadgeContent, 'AdminPanel:MediaUsageBadge:Content');

export function MediaUsageBadge({ count, mediaId, apiClient }: MediaUsageBadgeProps) {
  const [opened, setOpened] = useState(false);
  const [detail, setDetail] = useState<MediaUsageCampaignRef[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDetail() {
    if (detail !== null) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getMediaUsage(mediaId);
      setDetail(res.campaigns);
    } catch (err) {
      setError((err as Error).message || 'Failed to load usage detail');
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(next: boolean) {
    setOpened(next);
    if (next) {
      void loadDetail();
    }
  }

  const color = count === 0 ? 'red' : 'blue';
  const label = count === 0 ? 'Unused' : `${count} campaign${count === 1 ? '' : 's'}`;

  return (
    <Popover
      {...getWpsgDebugProps('MediaUsageBadge')}
      opened={opened}
      onChange={handleOpen}
      withArrow
      shadow="md"
      width={240}
      position="bottom-start"
    >
      <Popover.Target>
        <Badge
          {...getWpsgDebugProps('MediaUsageBadge', 'badge')}
          color={color}
          variant="light"
          size="sm"
          style={{ cursor: 'pointer' }}
          onClick={() => handleOpen(!opened)}
          aria-label={`Media used in ${label}`}
        >
          {label}
        </Badge>
      </Popover.Target>

      <Popover.Dropdown {...getWpsgDebugProps('MediaUsageBadge', 'dropdown')}>
        <MediaUsageBadgeContent loading={loading} error={error} detail={detail} />
      </Popover.Dropdown>
    </Popover>
  );
}

setWpsgDebugDisplayName(MediaUsageBadge, 'AdminPanel:MediaUsageBadge');