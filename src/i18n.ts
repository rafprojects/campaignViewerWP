/**
 * P49-C / P54-B: i18n bootstrap
 *
 * Initialises i18next with the `wpsg` namespace. Strings are sourced from
 * `window.__WPSG_I18N__.strings` when the PHP layer has injected them via
 * wp_localize_script / page_config_js.
 *
 * English defaults (src/i18n-strings.en.json) are always loaded as the 'en'
 * resource so the UI shows correct English text in standalone/Storybook mode.
 * PHP-injected strings override the defaults for the active locale.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enStrings from './i18n-strings.en.json';

declare global {
  interface Window {
    __WPSG_I18N__?: {
      locale?: string;
      strings?: Record<string, string>;
    };
  }
}

const injected = window.__WPSG_I18N__ ?? {};
const locale = injected.locale ?? 'en';

const resources: Record<string, { wpsg: Record<string, string> }> = {
  en: { wpsg: enStrings },
};

if (locale !== 'en') {
  resources[locale] = { wpsg: injected.strings ?? {} };
} else {
  // Merge PHP-injected strings over the English defaults
  resources.en = { wpsg: { ...enStrings, ...(injected.strings ?? {}) } };
}

i18n.use(initReactI18next).init({
  lng: locale,
  fallbackLng: 'en',
  defaultNS: 'wpsg',
  resources,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
