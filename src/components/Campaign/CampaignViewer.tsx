import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import { VideoCarousel } from './VideoCarousel';
import { ImageCarousel } from './ImageCarousel';
import type { Campaign } from '@/types';
import styles from './CampaignViewer.module.scss';

interface CampaignViewerProps {
  campaign: Campaign;
  hasAccess: boolean;
  onClose: () => void;
}

export function CampaignViewer({ campaign, hasAccess, onClose }: CampaignViewerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.overlay}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={styles.backdrop}
        onClick={onClose}
      />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={styles.modal}
      >
        {/* Cover Image Header */}
        <div className={styles.cover}>
          <img
            src={campaign.coverImage}
            alt={campaign.title}
            className={styles.coverImage}
          />
          <div className={styles.coverOverlay} />

          {/* Back button */}
          <button
            onClick={onClose}
            className={styles.backButton}
          >
            <ArrowLeft className={styles.backIcon} />
            <span>Back to Gallery</span>
          </button>

          {/* Company badge */}
          <div
            className={styles.companyBadge}
            style={{ backgroundColor: campaign.company.brandColor }}
          >
            <span className={styles.companyLogo}>{campaign.company.logo}</span>
            <span>{campaign.company.name}</span>
          </div>

          {/* Title overlay */}
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>
              {campaign.title}
            </h1>
            <div className={styles.meta}>
              <span className={styles.metaItem}>
                <Calendar className={styles.metaIcon} />
                {new Date(campaign.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className={styles.metaItem}>
                <Tag className={styles.metaIcon} />
                {campaign.tags.join(', ')}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Description */}
          <div>
            <h2 className={styles.sectionTitle}>About this Campaign</h2>
            <p className={styles.description}>{campaign.description}</p>
          </div>

          {!hasAccess && (
            <div className={styles.accessNotice}>
              <p>This campaign is private. Sign in or request access to view media.</p>
            </div>
          )}

          {/* Videos Section */}
          {hasAccess && campaign.videos.length > 0 && (
            <VideoCarousel videos={campaign.videos} />
          )}

          {/* Images Section */}
          {hasAccess && campaign.images.length > 0 && (
            <ImageCarousel images={campaign.images} />
          )}

          {/* Campaign Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statsCard}>
              <div className={styles.statsValue}>{campaign.videos.length}</div>
              <div className={styles.statsLabel}>Videos</div>
            </div>
            <div className={styles.statsCard}>
              <div className={styles.statsValue}>{campaign.images.length}</div>
              <div className={styles.statsLabel}>Images</div>
            </div>
            <div className={styles.statsCard}>
              <div className={styles.statsValue}>{campaign.tags.length}</div>
              <div className={styles.statsLabel}>Tags</div>
            </div>
            <div className={styles.statsCard}>
              <div className={styles.statsValue}>
                {campaign.visibility === 'public' ? '🌐' : '🔒'}
              </div>
              <div className={styles.statsLabel}>
                {campaign.visibility === 'public' ? 'Public' : 'Private'}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
