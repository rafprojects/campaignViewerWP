import { motion } from 'framer-motion';
import { Lock, Eye } from 'lucide-react';
import type { Campaign } from '@/types';

interface CampaignCardProps {
  campaign: Campaign;
  hasAccess: boolean;
  onClick: () => void;
}

export function CampaignCard({ campaign, hasAccess, onClick }: CampaignCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: hasAccess ? 1.03 : 1.01, y: hasAccess ? -5 : 0 }}
      whileTap={{ scale: hasAccess ? 0.98 : 1 }}
      onClick={hasAccess ? onClick : undefined}
      className={`relative overflow-hidden rounded-2xl bg-slate-800 shadow-xl cursor-pointer group ${
        !hasAccess ? 'cursor-not-allowed opacity-75' : ''
      }`}
      style={{
        borderLeft: `4px solid ${campaign.company.brandColor}`,
      }}
    >
      {/* Thumbnail */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={campaign.thumbnail}
          alt={campaign.title}
          className={`w-full h-full object-cover transition-transform duration-500 ${
            hasAccess ? 'group-hover:scale-110' : 'filter grayscale'
          }`}
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        
        {/* Lock overlay for inaccessible cards */}
        {!hasAccess && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
            <div className="bg-slate-800/90 rounded-full p-4">
              <Lock className="w-8 h-8 text-slate-400" />
            </div>
          </div>
        )}

        {/* Access indicator */}
        {hasAccess && (
          <div className="absolute top-3 right-3 bg-green-500/90 rounded-full p-2">
            <Eye className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Company badge */}
        <div
          className="absolute top-3 left-3 px-3 py-1 rounded-full text-sm font-medium text-white flex items-center gap-2"
          style={{ backgroundColor: campaign.company.brandColor }}
        >
          <span>{campaign.company.logo}</span>
          <span>{campaign.company.name}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
          {campaign.title}
        </h3>
        <p className="text-slate-400 text-sm line-clamp-2 mb-4">
          {campaign.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {campaign.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Media count */}
        <div className="flex items-center gap-4 mt-4 text-slate-500 text-sm">
          <span>🎬 {campaign.videos.length} videos</span>
          <span>🖼️ {campaign.images.length} images</span>
        </div>
      </div>

      {/* Hover effect border */}
      {hasAccess && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          style={{
            border: `2px solid ${campaign.company.brandColor}`,
          }}
        />
      )}
    </motion.div>
  );
}
