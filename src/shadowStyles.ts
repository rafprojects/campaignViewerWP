/**
 * Shadow DOM Inline Styles
 *
 * Concatenates structural CSS for injection into shadow roots.
 * Color theming is handled by MantineProvider's cssVariablesSelector
 * and the ThemeContext's CSS variable injection — no color CSS here.
 *
 * Global.scss contains only structural/reset rules. The legacy token bridge
 * (_tokens.scss) it used to pull in was deleted in P76-E; modules read
 * --mullion-* directly.
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §Shadow DOM Integration
 */

import mantineCoreStyles from '@mantine/core/styles.css?inline';
import mantineNotificationsStyles from '@mantine/notifications/styles.css?inline';
import rowsPhotoAlbumStyles from 'react-photo-album/rows.css?inline';
import masonryPhotoAlbumStyles from 'react-photo-album/masonry.css?inline';
import globalStyles from './styles/global.scss?inline';
import chromePortableStyles from './styles/chrome-portable.scss?inline';
import campaignCardStyles from './components/CampaignGallery/CampaignCard.module.scss?inline';
import cardGalleryStyles from './components/CampaignGallery/CardGallery.module.scss?inline';
import campaignViewerStyles from './components/CardViewer/CampaignViewer.module.scss?inline';
// P77-C: the Media tab renders inline in the gallery tree (Admin panel), so
// its modules were dead under the shipped mount until registered here.
import mediaCardStyles from './components/Admin/MediaCard.module.scss?inline';
import mediaTabStyles from './components/Admin/MediaTab.module.scss?inline';

export const shadowStyles = [
  mantineCoreStyles,
  mantineNotificationsStyles,
  rowsPhotoAlbumStyles,
  masonryPhotoAlbumStyles,
  globalStyles,
  // Also imported unconditionally in main.tsx for the portaled light-DOM
  // copy; shadow roots do not inherit document styles, so it is needed here
  // as well. See the header of chrome-portable.scss.
  chromePortableStyles,
  campaignCardStyles,
  cardGalleryStyles,
  campaignViewerStyles,
  mediaCardStyles,
  mediaTabStyles,
].join('\n');
