/**
 * Theme — Thin re-export from the theme system
 *
 * This file exists for backward compatibility. All code that imports
 * `theme` from `./theme` will receive the default-dark theme's
 * pre-computed MantineThemeOverride.
 *
 * For runtime theme switching, use the ThemeContext/useTheme hook
 * instead of importing this static export.
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md
 */

import { getMantineTheme, DEFAULT_THEME_ID } from './themes/index';

/**
 * Static theme export — returns the default-dark pre-computed
 * MantineThemeOverride. Used by test-utils and any code that
 * hasn't been migrated to ThemeContext yet.
 */
export const theme = getMantineTheme(DEFAULT_THEME_ID);

export default theme;

