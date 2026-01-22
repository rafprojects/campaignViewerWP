import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CampaignCard } from './CampaignCard';
import { CampaignViewer } from '@/components/Campaign/CampaignViewer';
import type { Campaign } from '@/types';
import styles from './CardGallery.module.scss';

interface CardGalleryProps {
  campaigns: Campaign[];
  userPermissions: string[];
  accessMode?: 'lock' | 'hide';
  isAdmin?: boolean;
  onAccessModeChange?: (mode: 'lock' | 'hide') => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onArchiveCampaign?: (campaign: Campaign) => void;
  onAddExternalMedia?: (campaign: Campaign) => void;
}

export function CardGallery({
  campaigns,
  userPermissions,
  accessMode = 'lock',
  isAdmin = false,
  onAccessModeChange,
  onEditCampaign,
  onArchiveCampaign,
  onAddExternalMedia,
}: CardGalleryProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const companies = [...new Set(campaigns.map((c) => c.company.name))];

  const hasAccess = (campaignId: string, visibility: 'public' | 'private') => {
    return visibility === 'public' || userPermissions.includes(campaignId);
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (filter === 'all') return true;
    if (filter === 'accessible') return hasAccess(campaign.id, campaign.visibility);
    return campaign.company.name === filter;
  }).filter((campaign) => {
    if (accessMode !== 'hide') {
      return true;
    }
    if (filter === 'accessible') {
      return true;
    }
    return hasAccess(campaign.id, campaign.visibility);
  });

  return (
    <div className={styles.gallery}>
      {/* Header */}
      <header className={styles.header}>
        <div className={`${styles.headerInner} wp-super-gallery__container`}>
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.headerTitle}>Campaign Gallery</h1>
              <p className={styles.headerSubtitle}>Browse and access your campaign media</p>
            </div>
            
            {/* Filter tabs */}
            <div className={styles.filters}>
              <button
                onClick={() => setFilter('all')}
                className={`${styles.filterButton} ${
                  filter === 'all' ? styles.filterButtonActiveAll : ''
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('accessible')}
                className={`${styles.filterButton} ${
                  filter === 'accessible' ? styles.filterButtonActiveAccessible : ''
                }`}
              >
                My Access
              </button>
              {companies.map((company) => (
                <button
                  key={company}
                  onClick={() => setFilter(company)}
                  className={`${styles.filterButton} ${
                    filter === company ? styles.filterButtonActiveCompany : ''
                  }`}
                >
                  {company}
                </button>
              ))}
            </div>

            {isAdmin && (
              <div className={styles.adminControls}>
                <span className={styles.adminLabel}>Access mode</span>
                <div className={styles.modeToggle}>
                  <button
                    onClick={() => onAccessModeChange?.('lock')}
                    className={`${styles.modeButton} ${
                      accessMode === 'lock' ? styles.modeButtonActive : ''
                    }`}
                  >
                    Lock
                  </button>
                  <button
                    onClick={() => onAccessModeChange?.('hide')}
                    className={`${styles.modeButton} ${
                      accessMode === 'hide' ? styles.modeButtonActive : ''
                    }`}
                  >
                    Hide
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Gallery Grid */}
      <main className={`${styles.main} wp-super-gallery__container`}>
        <motion.div
          layout
          className={styles.grid}
        >
          <AnimatePresence mode="popLayout">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                hasAccess={hasAccess(campaign.id, campaign.visibility)}
                onClick={() => setSelectedCampaign(campaign)}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredCampaigns.length === 0 && (
          <div className={styles.emptyState}>
            <p>No campaigns found matching your filter.</p>
          </div>
        )}
      </main>

      {/* Campaign Viewer Modal */}
      <AnimatePresence>
        {selectedCampaign && (
          <CampaignViewer
            campaign={selectedCampaign}
            hasAccess={hasAccess(selectedCampaign.id, selectedCampaign.visibility)}
            isAdmin={isAdmin}
            onEditCampaign={onEditCampaign}
            onArchiveCampaign={onArchiveCampaign}
            onAddExternalMedia={onAddExternalMedia}
            onClose={() => setSelectedCampaign(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
