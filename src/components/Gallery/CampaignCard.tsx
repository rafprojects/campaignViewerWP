import { forwardRef } from 'react';
import { IconLock, IconEye } from '@tabler/icons-react';
import { Card, Image, Badge, Group, Text, Box, Stack, UnstyledButton } from '@mantine/core';
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import { useTypographyStyle } from '@/hooks/useTypographyStyle';
import { RequestAccessForm } from './RequestAccessForm';
import styles from './CampaignCard.module.scss';

interface CampaignCardProps {
  campaign: Campaign;
  hasAccess: boolean;
  onClick: () => void;
  settings?: GalleryBehaviorSettings;
  apiClient?: ApiClient;
}

export const CampaignCard = forwardRef<HTMLButtonElement, CampaignCardProps>(
  ({ campaign, hasAccess, onClick, settings, apiClient }, ref) => {
    const borderRadius = settings?.cardBorderRadius ?? 8;
    const borderWidth = settings?.cardBorderWidth ?? 4;
    const borderMode = settings?.cardBorderMode ?? 'auto';
    // Resolve border color based on mode
    let resolvedBorderColor = campaign.company.brandColor;
    if (borderMode === 'single') {
      resolvedBorderColor = settings?.cardBorderColor ?? '#228be6';
    } else if (borderMode === 'individual' && campaign.borderColor) {
      resolvedBorderColor = campaign.borderColor;
    }
    const thumbHeight = settings?.cardThumbnailHeight ?? 200;
    const thumbFit = (settings?.cardThumbnailFit ?? 'cover') as 'cover' | 'contain';
    const shadow = settings?.cardShadowPreset ?? 'subtle';
    const shadowMap: Record<string, string> = {
      none: 'none',
      subtle: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)',
      medium: '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
      dramatic: '0 10px 25px rgba(0,0,0,0.2), 0 6px 10px rgba(0,0,0,0.1)',
    };
    const cardShadow = shadowMap[shadow] ?? shadowMap.subtle;
    const showBorder = settings?.showCardBorder !== false && borderWidth > 0;
    const showInfo = settings?.showCardInfoPanel !== false;
    const safeSettings = settings ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS;
    const cardTitleStyle = useTypographyStyle('cardTitle', safeSettings);
    return (
      <UnstyledButton
        ref={ref}
        onClick={hasAccess ? onClick : undefined}
        disabled={!hasAccess}
        aria-label={
          hasAccess
            ? `Open campaign ${campaign.title}`
            : `Campaign ${campaign.title} is locked`
        }
        className={styles.card}
        style={{
          cursor: hasAccess ? 'pointer' : 'not-allowed',
          opacity: hasAccess ? 1 : 0.75,
        }}
      >
        <Card
          padding={0}
          radius={borderRadius}
          withBorder={showBorder}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            ...(showBorder ? { borderLeft: `${borderWidth}px solid ${resolvedBorderColor}` } : {}),
            boxShadow: cardShadow,
            ...(settings?.cardAspectRatio && settings.cardAspectRatio !== 'auto' ? { aspectRatio: settings.cardAspectRatio.replace(':', ' / ') } : {}),
            ...(settings?.cardMinHeight ? { minHeight: `${settings.cardMinHeight}px` } : {}),
          }}
        >
          {/* Thumbnail Section */}
          <Card.Section
            pos="relative"
            h={showInfo ? { base: Math.round(thumbHeight * 0.8), sm: thumbHeight } : undefined}
            style={!showInfo ? { flex: 1, overflow: 'hidden' } : undefined}
            component="div"
          >
            <Image 
              src={campaign.thumbnail} 
              alt={campaign.title}
              h={showInfo ? { base: Math.round(thumbHeight * 0.8), sm: thumbHeight } : '100%'}
              fit={thumbFit}
              loading="lazy"
              style={{ 
                filter: hasAccess ? 'none' : 'grayscale(100%)',
                transition: 'transform 0.5s ease'
              }}
              className={styles.thumbnailImage}
            />
            
            {/* Overlay gradient */}
            {settings?.showCardThumbnailFade !== false && (
            <Box
              pos="absolute"
              inset={0}
              style={{
                background: 'linear-gradient(to top, var(--wpsg-color-background) 0%, color-mix(in srgb, var(--wpsg-color-background) 40%, transparent) 40%, transparent 70%)',
                pointerEvents: 'none'
              }}
            />
            )}
            
            {/* Lock overlay for inaccessible cards */}
            {!hasAccess && (
              <Box
                pos="absolute"
                inset={0}
                style={{
                  background: 'color-mix(in srgb, var(--wpsg-color-background) 60%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px',
                }}
              >
                {apiClient ? (
                  <RequestAccessForm
                    campaignId={campaign.id}
                    campaignTitle={campaign.title}
                    apiClient={apiClient}
                  />
                ) : (
                  <Box
                    p="lg"
                    style={{
                      background: 'color-mix(in srgb, var(--wpsg-color-surface) 90%, transparent)',
                      borderRadius: '9999px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconLock size={32} color="var(--wpsg-color-text-muted)" />
                  </Box>
                )}
              </Box>
            )}

            {/* Access indicator badge */}
            {hasAccess && settings?.showCardAccessBadge !== false && (
              <Badge
                pos="absolute"
                top={12}
                right={12}
                color="green"
                leftSection={<IconEye size={14} />}
              >
                Access
              </Badge>
            )}

            {/* Company badge */}
            {settings?.showCardCompanyName !== false && (
            <Badge
              pos="absolute"
              top={12}
              left={12}
              maw="70%"
              style={{ backgroundColor: campaign.company.brandColor, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              <Group gap={6}>
                <span>{campaign.company.logo}</span>
                <span>{campaign.company.name}</span>
              </Group>
            </Badge>
            )}
          </Card.Section>

          {/* Content Section */}
          {showInfo && (
          <Card.Section p="md">
          <Stack gap="sm">
            {settings?.showCardTitle !== false && (
            <Text fw={600} size="lg" lineClamp={1} style={cardTitleStyle}>
              {campaign.title}
            </Text>
            )}
            
            {settings?.showCardDescription !== false && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {campaign.description}
            </Text>
            )}

            {/* Tags */}
            <Group gap={6}>
              {campaign.tags.map((tag) => (
                <Badge key={tag} variant="light" size="sm">
                  #{tag}
                </Badge>
              ))}
            </Group>

            {/* Previous counts layout (kept for quick revert)
            <Group gap="md" mt="auto">
              <Text size="sm" c="dimmed">🎬 {campaign.videos.length} videos</Text>
              <Text size="sm" c="dimmed">🖼️ {campaign.images.length} images</Text>
            </Group>
            */}

            {settings?.showCardMediaCounts !== false && (
            <Group gap="xs" mt="auto" className={styles.mediaStats}>
              <span className={styles.mediaStat}>🎬 {campaign.videos.length} videos</span>
              <span className={styles.mediaStat}>🖼️ {campaign.images.length} images</span>
            </Group>
            )}
          </Stack>
          </Card.Section>
          )}

          {/* Hover border effect */}
          {hasAccess && showBorder && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: `2px solid ${resolvedBorderColor}`,
                borderRadius: borderRadius,
                pointerEvents: 'none',
              }}
            />
          )}
        </Card>
      </UnstyledButton>
    );
  },
);

CampaignCard.displayName = 'CampaignCard';
