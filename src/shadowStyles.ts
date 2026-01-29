import mantineCoreStyles from '@mantine/core/styles.css?inline';
import mantineNotificationsStyles from '@mantine/notifications/styles.css?inline';
import globalStyles from './styles/global.scss?inline';
import campaignCardStyles from './components/Gallery/CampaignCard.module.scss?inline';
import cardGalleryStyles from './components/Gallery/CardGallery.module.scss?inline';
import campaignViewerStyles from './components/Campaign/CampaignViewer.module.scss?inline';

export const shadowStyles = [
  mantineCoreStyles,
  mantineNotificationsStyles,
  globalStyles,
  campaignCardStyles,
  cardGalleryStyles,
  campaignViewerStyles,
].join('\n');
