import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Eye } from 'lucide-react';
import { Card, Image, Badge, Group, Text, Box, Stack } from '@mantine/core';
import type { Campaign } from '@/types';
import styles from './CampaignCard.module.scss';

interface CampaignCardProps {
  campaign: Campaign;
  hasAccess: boolean;
  onClick: () => void;
}

const MotionDiv = motion.div;

export const CampaignCard = forwardRef<HTMLDivElement, CampaignCardProps>(
  ({ campaign, hasAccess, onClick }, ref) => {
    const prefersReducedMotion = useReducedMotion();
    const cardVariants = {
      initial: { opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 },
      rest: { opacity: 1, scale: 1, y: 0 },
      hover: {
        opacity: 1,
        scale: prefersReducedMotion ? 1 : hasAccess ? 1.03 : 1.01,
        y: prefersReducedMotion ? 0 : hasAccess ? -5 : 0,
      },
    };

    const borderVariants = {
      initial: { opacity: 0 },
      rest: { opacity: 0 },
      hover: { opacity: 1 },
    };

    return (
      <MotionDiv
        ref={ref}
        layout
        variants={cardVariants}
        initial="initial"
        animate="rest"
        exit="initial"
        whileHover={hasAccess ? 'hover' : 'rest'}
        whileTap={{ scale: prefersReducedMotion ? 1 : hasAccess ? 0.98 : 1 }}
        onClick={hasAccess ? onClick : undefined}
        onKeyDown={(event) => {
          if (!hasAccess) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={hasAccess ? 0 : -1}
        aria-disabled={!hasAccess}
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
          shadow="sm"
          padding={0}
          radius="md"
          withBorder
          style={{
            position: 'relative',
            borderLeft: `4px solid ${campaign.company.brandColor}`,
          }}
        >
          {/* Thumbnail Section */}
          <Card.Section pos="relative" h={{ base: 160, sm: 200 }} component="div">
            <Image 
              src={campaign.thumbnail} 
              alt={campaign.title}
              h={{ base: 160, sm: 200 }}
              loading="lazy"
              style={{ 
                filter: hasAccess ? 'none' : 'grayscale(100%)',
                transition: 'transform 0.5s ease'
              }}
              className={styles.thumbnailImage}
            />
            
            {/* Overlay gradient */}
            <Box
              pos="absolute"
              inset={0}
              style={{
                background: 'linear-gradient(to top, rgba(15, 23, 42, 1) 0%, rgba(15, 23, 42, 0.4) 40%, transparent 70%)',
                pointerEvents: 'none'
              }}
            />
            
            {/* Lock overlay for inaccessible cards */}
            {!hasAccess && (
              <Box
                pos="absolute"
                inset={0}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  p="lg"
                  style={{
                    background: 'rgba(30, 41, 59, 0.9)',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Lock size={32} color="#94a3b8" />
                </Box>
              </Box>
            )}

            {/* Access indicator badge */}
            {hasAccess && (
              <Badge
                pos="absolute"
                top={12}
                right={12}
                color="green"
                leftSection={<Eye size={14} />}
              >
                Access
              </Badge>
            )}

            {/* Company badge */}
            <Badge
              pos="absolute"
              top={12}
              left={12}
              style={{ backgroundColor: campaign.company.brandColor }}
            >
              <Group gap={6}>
                <span>{campaign.company.logo}</span>
                <span>{campaign.company.name}</span>
              </Group>
            </Badge>
          </Card.Section>

          {/* Content Section */}
          <Stack p="md" gap="sm">
            <Text fw={600} size="lg" lineClamp={1} c="white">
              {campaign.title}
            </Text>
            
            <Text size="sm" c="dimmed" lineClamp={2}>
              {campaign.description}
            </Text>

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

            <Group gap="xs" mt="auto" className={styles.mediaStats}>
              <span className={styles.mediaStat}>🎬 {campaign.videos.length} videos</span>
              <span className={styles.mediaStat}>🖼️ {campaign.images.length} images</span>
            </Group>
          </Stack>

          {/* Hover border effect */}
          {hasAccess && (
            <motion.div
              variants={borderVariants}
              style={{
                position: 'absolute',
                inset: 0,
                border: `2px solid ${campaign.company.brandColor}`,
                borderRadius: 'var(--mantine-radius-md)',
                pointerEvents: 'none',
              }}
            />
          )}
        </Card>
      </MotionDiv>
    );
  },
);

CampaignCard.displayName = 'CampaignCard';
