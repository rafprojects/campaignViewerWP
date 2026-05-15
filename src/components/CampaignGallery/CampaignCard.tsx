import { forwardRef } from 'react';
import { IconLock, IconEye } from '@tabler/icons-react';
import { Card, Image, Badge, Group, Text, Box, Stack, UnstyledButton } from '@mantine/core';
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import { useTypographyStyle } from '@/hooks/useTypographyStyle';
import { toCss, toCssOrNumber } from '@/utils/cssUnits';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { RequestAccessForm } from './RequestAccessForm';
import { CompanyLogo } from '@/components/Common/CompanyLogo';
import styles from './CampaignCard.module.scss';

interface CampaignCardProps {
  campaign: Campaign;
  hasAccess: boolean;
  onClick: () => void;
  settings?: GalleryBehaviorSettings | undefined;
  apiClient?: ApiClient | undefined;
  maxWidth?: number | undefined;
  maxWidthUnit?: import('@/utils/cssUnits').CssWidthUnit | undefined;
}

export const CampaignCard = forwardRef<HTMLButtonElement, CampaignCardProps>(
  ({ campaign, hasAccess, onClick, settings, apiClient, maxWidth, maxWidthUnit = 'px' }, ref) => {
    const borderRadius = settings?.cardBorderRadius ?? 8;
    const borderRadiusUnit = settings?.cardBorderRadiusUnit ?? 'px';
    const borderWidth = settings?.cardBorderWidth ?? 4;
    const borderMode = settings?.cardBorderMode ?? 'auto';
    const lockedOpacity = settings?.cardLockedOpacity ?? 0.5;
    const lockIconSize = settings?.cardLockIconSize ?? 32;
    const accessIconSize = settings?.cardAccessIconSize ?? 14;
    const badgeOffsetY = settings?.cardBadgeOffsetY ?? 8;
    const companyBadgeMaxWidth = settings?.cardCompanyBadgeMaxWidth ?? 160;
    const thumbnailHoverTransitionMs = settings?.cardThumbnailHoverTransitionMs ?? 300;
    const gradientStartOpacity = settings?.cardGradientStartOpacity ?? 0;
    const gradientEndOpacity = settings?.cardGradientEndOpacity ?? 0.85;
    // Resolve border color based on mode
    let resolvedBorderColor = campaign.company.brandColor;
    if (borderMode === 'single') {
      resolvedBorderColor = settings?.cardBorderColor ?? '#228be6';
    } else if (borderMode === 'individual' && campaign.borderColor) {
      resolvedBorderColor = campaign.borderColor;
    }
    const thumbHeight = settings?.cardThumbnailHeight ?? 200;
    const thumbHeightUnit = settings?.cardThumbnailHeightUnit ?? 'px';
    const thumbFit = (settings?.cardThumbnailFit ?? 'cover') as 'cover' | 'contain';
    const scale = settings?.cardScale ?? 1;
    const scaledThumbHeight = Math.round(thumbHeight * scale);
    const scaledMinHeight = settings?.cardMinHeight ? Math.round(settings.cardMinHeight * scale) : settings?.cardMinHeight;
    const minHeightUnit = settings?.cardMinHeightUnit ?? 'px';
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
    const thumbnailFade = `linear-gradient(to top, color-mix(in srgb, var(--wpsg-color-background) ${Math.round(gradientEndOpacity * 100)}%, transparent) 0%, color-mix(in srgb, var(--wpsg-color-background) ${Math.round(gradientStartOpacity * 100)}%, transparent) 100%)`;
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
        {...(styles.card ? { className: styles.card } : {})}
        style={{
          cursor: hasAccess ? 'pointer' : 'not-allowed',
          opacity: hasAccess ? 1 : lockedOpacity,
          width: '100%',
          ...(maxWidth ? { maxWidth: toCss(maxWidth, maxWidthUnit) } : {}),
        }}
      >
        <Card
          padding={0}
          radius={toCssOrNumber(borderRadius, borderRadiusUnit)}
          withBorder={showBorder}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            ...(showBorder ? { borderLeft: `${borderWidth}px solid ${resolvedBorderColor}` } : {}),
            boxShadow: cardShadow,
            ...(settings?.cardAspectRatio && settings.cardAspectRatio !== 'auto' ? { aspectRatio: settings.cardAspectRatio.replace(':', ' / ') } : {}),
            ...(scaledMinHeight ? { minHeight: toCss(scaledMinHeight, minHeightUnit) } : {}),
          }}
        >
          {/* Thumbnail Section */}
          <Card.Section
            pos="relative"
            h={showInfo ? { base: toCssOrNumber(Math.round(scaledThumbHeight * 0.8), thumbHeightUnit), sm: toCssOrNumber(scaledThumbHeight, thumbHeightUnit) } : undefined}
            style={!showInfo ? { flex: 1, overflow: 'hidden' } : undefined}
            component="div"
          >
            <Image
              src={campaign.thumbnail}
              alt={campaign.title}
              h={showInfo ? { base: toCssOrNumber(Math.round(scaledThumbHeight * 0.8), thumbHeightUnit), sm: toCssOrNumber(scaledThumbHeight, thumbHeightUnit) } : '100%'}
              fit={thumbFit}
              loading="lazy"
              style={{
                filter: hasAccess ? 'none' : 'grayscale(100%)',
                transition: `transform ${thumbnailHoverTransitionMs}ms ease`
              }}
              {...(styles.thumbnailImage ? { className: styles.thumbnailImage } : {})}
            />

            {/* Overlay gradient */}
            {settings?.showCardThumbnailFade !== false && (
              <Box
                pos="absolute"
                inset={0}
                style={{
                  background: thumbnailFade,
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
                    <IconLock size={lockIconSize} color="var(--wpsg-color-text-muted)" />
                  </Box>
                )}
              </Box>
            )}

            {/* Access indicator badge */}
            {hasAccess && settings?.showCardAccessBadge !== false && (
              <Badge
                pos="absolute"
                top={badgeOffsetY}
                right={12}
                color="green"
                leftSection={<IconEye size={accessIconSize} />}
              >
                Access
              </Badge>
            )}

            {/* Company badge */}
            {settings?.showCardCompanyName !== false && (
              <Badge
                pos="absolute"
                top={badgeOffsetY}
                left={12}
                maw={companyBadgeMaxWidth}
                style={{ backgroundColor: campaign.company.brandColor, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                <Group gap={6}>
                  <CompanyLogo logo={campaign.company.logo} companyName={campaign.company.name} />
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
                  <Group gap="xs" mt="auto" {...(styles.mediaStats ? { className: styles.mediaStats } : {})}>
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
                borderRadius: toCssOrNumber(borderRadius, borderRadiusUnit),
                pointerEvents: 'none',
              }}
            />
          )}
        </Card>
      </UnstyledButton>
    );
  },
);

setWpsgDebugDisplayName(CampaignCard, 'CampaignCard');
