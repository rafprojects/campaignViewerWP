import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import { VideoCarousel } from './VideoCarousel';
import { ImageCarousel } from './ImageCarousel';
import type { Campaign } from '@/types';

interface CampaignViewerProps {
  campaign: Campaign;
  onClose: () => void;
}

export function CampaignViewer({ campaign, onClose }: CampaignViewerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative min-h-screen md:min-h-0 md:my-8 md:mx-auto md:max-w-5xl md:rounded-2xl bg-slate-800 overflow-hidden"
      >
        {/* Cover Image Header */}
        <div className="relative h-64 md:h-80">
          <img
            src={campaign.coverImage}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-slate-800/50 to-transparent" />

          {/* Back button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Gallery</span>
          </button>

          {/* Company badge */}
          <div
            className="absolute top-4 right-4 px-4 py-2 rounded-full text-white font-medium flex items-center gap-2"
            style={{ backgroundColor: campaign.company.brandColor }}
          >
            <span className="text-xl">{campaign.company.logo}</span>
            <span>{campaign.company.name}</span>
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {campaign.title}
            </h1>
            <div className="flex items-center gap-4 text-slate-300">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {campaign.createdAt.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {campaign.tags.join(', ')}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">About this Campaign</h2>
            <p className="text-slate-300 leading-relaxed">{campaign.description}</p>
          </div>

          {/* Videos Section */}
          {campaign.videos.length > 0 && (
            <VideoCarousel videos={campaign.videos} />
          )}

          {/* Images Section */}
          {campaign.images.length > 0 && (
            <ImageCarousel images={campaign.images} />
          )}

          {/* Campaign Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700">
            <div className="text-center p-4 bg-slate-700/50 rounded-xl">
              <div className="text-2xl font-bold text-white">{campaign.videos.length}</div>
              <div className="text-slate-400 text-sm">Videos</div>
            </div>
            <div className="text-center p-4 bg-slate-700/50 rounded-xl">
              <div className="text-2xl font-bold text-white">{campaign.images.length}</div>
              <div className="text-slate-400 text-sm">Images</div>
            </div>
            <div className="text-center p-4 bg-slate-700/50 rounded-xl">
              <div className="text-2xl font-bold text-white">{campaign.tags.length}</div>
              <div className="text-slate-400 text-sm">Tags</div>
            </div>
            <div className="text-center p-4 bg-slate-700/50 rounded-xl">
              <div className="text-2xl font-bold text-white">
                {campaign.isPublic ? '🌐' : '🔒'}
              </div>
              <div className="text-slate-400 text-sm">
                {campaign.isPublic ? 'Public' : 'Private'}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
