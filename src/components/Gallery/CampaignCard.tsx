import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye } from 'lucide-react';
import type { Campaign } from '@/types';
import styles from './CampaignCard.module.scss';

interface CampaignCardProps {
  campaign: Campaign;
  hasAccess: boolean;
  onClick: () => void;
}

export const CampaignCard = forwardRef<HTMLDivElement, CampaignCardProps>(
  ({ campaign, hasAccess, onClick }, ref) => {
    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ scale: hasAccess ? 1.03 : 1.01, y: hasAccess ? -5 : 0 }}
        whileTap={{ scale: hasAccess ? 0.98 : 1 }}
        onClick={hasAccess ? onClick : undefined}
        className={`${styles.card} ${!hasAccess ? styles.cardLocked : ''}`}
        style={{
          borderLeft: `4px solid ${campaign.company.brandColor}`,
        }}
      >
      {/* Thumbnail */}
      <div className={styles.thumbnail}>
        <img
          src={campaign.thumbnail}
          alt={campaign.title}
          className={`${styles.thumbnailImage} ${!hasAccess ? styles.thumbnailImageLocked : ''}`}
        />
        
        {/* Overlay gradient */}
        <div className={styles.overlayGradient} />
        
        {/* Lock overlay for inaccessible cards */}
        {!hasAccess && (
          <div className={styles.lockOverlay}>
            <div className={styles.lockIcon}>
              <Lock className={styles.lockIconSvg} />
            </div>
          </div>
        )}

        {/* Access indicator */}
        {hasAccess && (
          <div className={styles.accessBadge}>
            <Eye className={styles.accessIcon} />
          </div>
        )}

        {/* Company badge */}
        <div
          className={styles.companyBadge}
          style={{ backgroundColor: campaign.company.brandColor }}
        >
          <span>{campaign.company.logo}</span>
          <span>{campaign.company.name}</span>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <h3 className={styles.title}>
          {campaign.title}
        </h3>
        <p className={styles.description}>
          {campaign.description}
        </p>

        {/* Tags */}
        <div className={styles.tags}>
          {campaign.tags.map((tag) => (
            <span
              key={tag}
              className={styles.tag}
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Media count */}
        <div className={styles.mediaStats}>
          <span>🎬 {campaign.videos.length} videos</span>
          <span>🖼️ {campaign.images.length} images</span>
        </div>
      </div>

      {/* Hover effect border */}
        {hasAccess && (
          <motion.div
            className={styles.hoverBorder}
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            style={{
              border: `2px solid ${campaign.company.brandColor}`,
            }}
          />
        )}
      </motion.div>
    );
  },
);

CampaignCard.displayName = 'CampaignCard';
