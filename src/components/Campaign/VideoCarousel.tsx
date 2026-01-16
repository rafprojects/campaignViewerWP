import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { MediaItem } from '@/types';
import styles from './VideoCarousel.module.scss';

interface VideoCarouselProps {
  videos: MediaItem[];
}

export function VideoCarousel({ videos }: VideoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const nextVideo = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
    setIsPlaying(false);
  };

  const prevVideo = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
    setIsPlaying(false);
  };

  const currentVideo = videos[currentIndex];

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>
        <Play className={styles.icon} />
        Videos ({videos.length})
      </h3>

      <div className={styles.playerWrapper}>
        {/* Main Video Display */}
        <div className={styles.videoFrame}>
          {isPlaying ? (
            <iframe
              src={`${currentVideo.url}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={styles.poster}
            >
              <img
                src={currentVideo.thumbnail}
                alt={currentVideo.caption}
                className={styles.posterImage}
              />
              <button
                onClick={() => setIsPlaying(true)}
                className={styles.playOverlay}
              >
                <div className={styles.playButton}>
                  <Play className={styles.playIcon} fill="currentColor" />
                </div>
              </button>
            </motion.div>
          )}
        </div>

        {/* Navigation Arrows */}
        {videos.length > 1 && (
          <>
            <button
              onClick={prevVideo}
              className={`${styles.navButton} ${styles.navButtonLeft}`}
            >
              <ChevronLeft className={styles.navIcon} />
            </button>
            <button
              onClick={nextVideo}
              className={`${styles.navButton} ${styles.navButtonRight}`}
            >
              <ChevronRight className={styles.navIcon} />
            </button>
          </>
        )}
      </div>

      {/* Caption */}
      <p className={styles.caption}>{currentVideo.caption}</p>

      {/* Thumbnail Strip */}
      {videos.length > 1 && (
        <div className={styles.thumbnailStrip}>
          {videos.map((video, index) => (
            <button
              key={video.id}
              onClick={() => {
                setCurrentIndex(index);
                setIsPlaying(false);
              }}
              className={`${styles.thumbnailButton} ${
                index === currentIndex ? styles.thumbnailButtonActive : ''
              }`}
            >
              <img
                src={video.thumbnail}
                alt={video.caption}
                className={styles.thumbnailImage}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
