import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image, X, ZoomIn } from 'lucide-react';
import type { MediaItem } from '@/types';
import styles from './ImageCarousel.module.scss';

interface ImageCarouselProps {
  images: MediaItem[];
}

export function ImageCarousel({ images }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const currentImage = images[currentIndex];

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>
        <Image className={styles.icon} />
        Images ({images.length})
      </h3>

      <div className={styles.viewer}>
        {/* Main Image Display */}
        <div className={styles.imageFrame}>
          <AnimatePresence mode="wait">
            <motion.img
              key={currentIndex}
              src={currentImage.url}
              alt={currentImage.caption}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className={styles.mainImage}
              onClick={() => setIsLightboxOpen(true)}
            />
          </AnimatePresence>

          {/* Zoom button */}
          <button
            onClick={() => setIsLightboxOpen(true)}
            className={styles.zoomButton}
          >
            <ZoomIn className={styles.iconSmall} />
          </button>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className={`${styles.navButton} ${styles.navButtonLeft}`}
              >
                <ChevronLeft className={styles.navIcon} />
              </button>
              <button
                onClick={nextImage}
                className={`${styles.navButton} ${styles.navButtonRight}`}
              >
                <ChevronRight className={styles.navIcon} />
              </button>
            </>
          )}

          {/* Image counter */}
          <div className={styles.counter}>
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className={styles.caption}>{currentImage.caption}</p>

      {/* Thumbnail Strip */}
      <div className={styles.thumbnailStrip}>
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => setCurrentIndex(index)}
            className={`${styles.thumbnailButton} ${
              index === currentIndex ? styles.thumbnailButtonActive : ''
            }`}
          >
            <img
              src={image.url}
              alt={image.caption}
              className={styles.thumbnailImage}
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.lightbox}
            onClick={() => setIsLightboxOpen(false)}
          >
            <button
              onClick={() => setIsLightboxOpen(false)}
              className={styles.lightboxClose}
            >
              <X className={styles.lightboxIcon} />
            </button>

            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={currentImage.url}
              alt={currentImage.caption}
              className={styles.lightboxImage}
              onClick={(e) => e.stopPropagation()}
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className={`${styles.lightboxNavButton} ${styles.lightboxNavLeft}`}
                >
                  <ChevronLeft className={styles.lightboxNavIcon} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className={`${styles.lightboxNavButton} ${styles.lightboxNavRight}`}
                >
                  <ChevronRight className={styles.lightboxNavIcon} />
                </button>
              </>
            )}

            <div className={styles.lightboxCaption}>
              <p className={styles.lightboxCaptionTitle}>{currentImage.caption}</p>
              <p className={styles.lightboxCaptionMeta}>
                {currentIndex + 1} / {images.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
