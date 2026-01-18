import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CampaignCard } from './CampaignCard';
import { CampaignViewer } from '@/components/Campaign/CampaignViewer';
import type { Campaign } from '@/types';
import styles from './CardGallery.module.scss';

interface CardGalleryProps {
  campaigns: Campaign[];
  userPermissions: string[];
}

export function CardGallery({ campaigns, userPermissions }: CardGalleryProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const companies = [...new Set(campaigns.map((c) => c.company.name))];

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (filter === 'all') return true;
    if (filter === 'accessible') return userPermissions.includes(campaign.id) || campaign.isPublic;
    return campaign.company.name === filter;
  });

  const hasAccess = (campaignId: string, isPublic: boolean) => {
    return isPublic || userPermissions.includes(campaignId);
  };

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
                hasAccess={hasAccess(campaign.id, campaign.isPublic)}
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
            onClose={() => setSelectedCampaign(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
