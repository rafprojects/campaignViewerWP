import { Button, Group, Image, Modal, Stack, Text, Badge } from '@mantine/core';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import type { UploadDuplicateCampaign } from '@/types';
import { getMullionDebugProps, setMullionDebugDisplayName } from '@/utils/mullionDebug';

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
  if (campaigns.length === 0) return i18n.t('ndw_campaign_none', 'Not in any campaign', { ns: 'mullion' });
  if (campaigns.length === 1) return i18n.t('ndw_campaign_one', 'Used in: {{a}}', { a: campaigns[0]!.title, ns: 'mullion' });
  if (campaigns.length === 2) return i18n.t('ndw_campaign_two', 'Used in: {{a}}, {{b}}', { a: campaigns[0]!.title, b: campaigns[1]!.title, ns: 'mullion' });
  const rest = campaigns.length - 2;
  return i18n.t('ndw_campaign_more', 'Used in: {{a}}, {{b}} and {{count}} more', { a: campaigns[0]!.title, b: campaigns[1]!.title, count: rest, ns: 'mullion' });
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
  const { t } = useTranslation('mullion');
  return (
    <Modal
      {...getMullionDebugProps('NearDuplicateWarning')}
      opened={opened}
      onClose={onDismiss}
      withinPortal={false}
      title={<span {...getMullionDebugProps('NearDuplicateWarning', 'title')}>{t('ndw_title', 'Visually similar image found')}</span>}
      closeButtonProps={getMullionDebugProps('NearDuplicateWarning', 'close')}
      overlayProps={getMullionDebugProps('NearDuplicateWarning', 'overlay')}
      padding="md"
    >
      <Stack {...getMullionDebugProps('NearDuplicateWarning', 'stack')}>
        <Text size="sm">
          <Trans
            i18nKey="ndw_looks_like"
            values={{ filename }}
            components={{ strong: <strong /> }}
            defaults="<strong>{{filename}}</strong> looks like an image already in your library."
          />
        </Text>

        <Group align="flex-start" gap="md">
          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" c="dimmed">{t('ndw_existing_image', 'Existing image')}</Text>
            <Image
              {...getMullionDebugProps('NearDuplicateWarning', 'similar-image')}
              src={similarUrl}
              alt={t('ndw_similar_alt', 'Similar existing image')}
              fit="contain"
              h={120}
              radius="sm"
              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23eee'/%3E%3C/svg%3E"
            />
            <Stack gap={2}>
              {originalName ? (
                <Text size="xs" c="dimmed">
                  <strong>{t('ndw_original_label', 'Original:')}</strong> {originalName}
                </Text>
              ) : null}
              <Text
                {...getMullionDebugProps('NearDuplicateWarning', 'campaign-line')}
                size="xs"
                c="dimmed"
              >
                {formatCampaignLine(campaigns)}
              </Text>
              <Badge
                {...getMullionDebugProps('NearDuplicateWarning', 'distance-badge')}
                variant="light"
                color="orange"
                size="sm"
              >
                {distance === 0 ? t('ndw_identical', 'Identical content') : t('ndw_bits_diff', '{{count}}/64 bits different', { count: distance })}
              </Badge>
            </Stack>
          </Stack>
        </Group>

        <Text size="xs" c="dimmed">
          {t('ndw_help', 'Use the existing image to avoid duplicates, or upload this file anyway.')}
        </Text>

        <Group {...getMullionDebugProps('NearDuplicateWarning', 'actions')} justify="flex-end">
          <Button variant="default" onClick={onDismiss}>{t('common_cancel', 'Cancel')}</Button>
          <Button
            {...getMullionDebugProps('NearDuplicateWarning', 'use-existing')}
            variant="light"
            onClick={onUseExisting}
            loading={loading}
          >
            {t('ndw_use_existing', 'Use existing')}
          </Button>
          <Button
            {...getMullionDebugProps('NearDuplicateWarning', 'upload-anyway')}
            onClick={onUploadAnyway}
            loading={loading}
          >
            {t('ndw_upload_anyway', 'Upload anyway')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setMullionDebugDisplayName(NearDuplicateWarning, 'NearDuplicateWarning');
