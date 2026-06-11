/**
 * P49-C: i18n bootstrap
 *
 * Initialises i18next with the `wpsg` namespace. Strings are sourced from
 * `window.__WPSG_I18N__.strings` when the PHP layer has injected them via
 * wp_localize_script / page_config_js. Falls back to the key itself (English)
 * so the UI degrades gracefully in standalone/Storybook mode.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

declare global {
  interface Window {
    __WPSG_I18N__?: {
      locale?: string;
      strings?: Record<string, string>;
    };
  }
}

const injected = window.__WPSG_I18N__ ?? {};

i18n.use(initReactI18next).init({
  lng: injected.locale ?? 'en',
  fallbackLng: 'en',
  defaultNS: 'wpsg',
  resources: {
    [injected.locale ?? 'en']: {
      wpsg: injected.strings ?? {},
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
