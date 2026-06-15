/**
 * Bundled theme definitions shipped with the engine.
 *
 * [P51-L] Moved out of the app's theme registry (`src/themes/index.ts`) so the
 * 23 built-in themes + base defaults travel with the package. The app-side
 * registry imports these, deep-merges + validates + adapts them to Mantine.
 */
import type { ThemeExtension } from './types';

import baseDefaults from './definitions/_base.json';
import defaultDarkDef from './definitions/default-dark.json';
import defaultLightDef from './definitions/default-light.json';
import materialDarkDef from './definitions/material-dark.json';
import materialLightDef from './definitions/material-light.json';
import darculaDef from './definitions/darcula.json';
import nordDef from './definitions/nord.json';
import solarizedDarkDef from './definitions/solarized-dark.json';
import solarizedLightDef from './definitions/solarized-light.json';
import highContrastDef from './definitions/high-contrast.json';
import catppuccinMochaDef from './definitions/catppuccin-mocha.json';
import tokyoNightDef from './definitions/tokyo-night.json';
import gruvboxDarkDef from './definitions/gruvbox-dark.json';
import cyberpunkDef from './definitions/cyberpunk.json';
import synthwaveDef from './definitions/synthwave.json';
import githubLightDef from './definitions/github-light.json';
import catppuccinLatteDef from './definitions/catppuccin-latte.json';
import sunsetBoulevardDef from './definitions/sunset-boulevard.json';
import oceanBreezeDef from './definitions/ocean-breeze.json';
import crimsonCanvasDef from './definitions/crimson-canvas.json';
import forestWhisperDef from './definitions/forest-whisper.json';
import halloweenDef from './definitions/halloween.json';
import reverseHalloweenDef from './definitions/reverse-halloween.json';
import midnightRoseDef from './definitions/midnight-rose.json';

/** Base defaults that every theme extension is deep-merged onto. */
export const baseThemeDefaults = baseDefaults as unknown as Record<string, unknown>;

/** All bundled theme extensions, in registration (display fallback) order. */
export const bundledThemeDefinitions: ThemeExtension[] = [
  defaultDarkDef,
  defaultLightDef,
  materialDarkDef,
  materialLightDef,
  darculaDef,
  nordDef,
  solarizedDarkDef,
  solarizedLightDef,
  highContrastDef,
  catppuccinMochaDef,
  tokyoNightDef,
  gruvboxDarkDef,
  cyberpunkDef,
  synthwaveDef,
  githubLightDef,
  catppuccinLatteDef,
  sunsetBoulevardDef,
  oceanBreezeDef,
  crimsonCanvasDef,
  forestWhisperDef,
  halloweenDef,
  reverseHalloweenDef,
  midnightRoseDef,
].map((def) => def as unknown as ThemeExtension);
