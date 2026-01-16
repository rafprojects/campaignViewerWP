import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CampaignCard } from './CampaignCard';
import { CampaignViewer } from '../Campaign/CampaignViewer';
import type { Campaign } from '@/types';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Campaign Gallery</h1>
              <p className="text-slate-400 text-sm">Browse and access your campaign media</p>
            </div>
            
            {/* Filter tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('accessible')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'accessible'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                My Access
              </button>
              {companies.map((company) => (
                <button
                  key={company}
                  onClick={() => setFilter(company)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === company
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
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
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No campaigns found matching your filter.</p>
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
