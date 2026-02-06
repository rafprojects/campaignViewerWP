/**
 * Shadow DOM Inline Styles
 *
 * Concatenates structural CSS for injection into shadow roots.
 * Color theming is handled by MantineProvider's cssVariablesSelector
 * and the ThemeContext's CSS variable injection — no color CSS here.
 *
 * Global.scss contains only structural/reset rules + the legacy token
 * bridge (_tokens.scss) that aliases --color-* → --wpsg-*.
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §Shadow DOM Integration
 */

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
