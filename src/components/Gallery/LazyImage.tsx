/**
 * LazyImage — Progressive image loading component for gallery tiles.
 *
 * P13-B: Provides a smooth loading experience for gallery thumbnails:
 *  1. Shows a neutral CSS skeleton placeholder while the image loads
 *  2. Fades the image in on `onLoad` with a fast opacity transition
 *  3. Falls back to FALLBACK_IMAGE_SRC on error
 *  4. Uses native `loading="lazy"` for browser-deferred loading
 *
 * Drop-in replacement for `<img>` — accepts the same style/className props.
 * Designed for tile adapters (compact-grid, circular, hexagonal, diamond)
 * and react-photo-album's render.image override (justified, masonry).
 */
import { useState, useCallback, type CSSProperties, type ImgHTMLAttributes } from 'react';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';

interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  /** Additional styles merged onto the <img>. */
  style?: CSSProperties;
  /** Fade-in duration in ms. Default 200. */
  fadeDuration?: number;
  /** Called once when the image successfully loads (after fade-in starts). */
  onLoaded?: () => void;
  /** Override native loading attribute. Default "lazy". */
  loading?: 'lazy' | 'eager';
}

export function LazyImage({
  src,
  alt = '',
  style,
  fadeDuration = 200,
  onLoaded,
  loading = 'lazy',
  ...rest
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoaded?.();
  }, [onLoaded]);
  const handleError = useCallback(() => {
    setErrored(true);
    setLoaded(true); // show fallback without skeleton
    onLoaded?.();
  }, [onLoaded]);

  return (
    <img
      {...rest}
      src={errored ? FALLBACK_IMAGE_SRC : src}
      alt={alt}
      loading={loading}
      onLoad={handleLoad}
      onError={handleError}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: `opacity ${fadeDuration}ms ease`,
      }}
    />
  );
}
