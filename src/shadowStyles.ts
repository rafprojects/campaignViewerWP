import globalStyles from './styles/global.scss?inline';
import campaignCardStyles from './components/Gallery/CampaignCard.module.scss?inline';
import cardGalleryStyles from './components/Gallery/CardGallery.module.scss?inline';
import videoCarouselStyles from './components/Campaign/VideoCarousel.module.scss?inline';
import imageCarouselStyles from './components/Campaign/ImageCarousel.module.scss?inline';
import campaignViewerStyles from './components/Campaign/CampaignViewer.module.scss?inline';

export const shadowStyles = [
  globalStyles,
  campaignCardStyles,
  cardGalleryStyles,
  videoCarouselStyles,
  imageCarouselStyles,
  campaignViewerStyles,
].join('\n');
