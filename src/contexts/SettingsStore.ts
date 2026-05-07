import { createStore } from 'zustand/vanilla';

import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
} from '@/types';
import { mergeSettingsWithDefaults } from '@/utils/mergeSettingsWithDefaults';

export interface SettingsData extends GalleryBehaviorSettings {
  theme?: string;
  galleryLayout: 'grid' | 'masonry' | 'carousel';
  itemsPerPage: number;
  enableLightbox: boolean;
  enableAnimations: boolean;
}

export type SettingsDataInput = Partial<GalleryBehaviorSettings> & {
  theme?: string;
  galleryLayout?: string;
  itemsPerPage?: number;
  enableLightbox?: boolean;
  enableAnimations?: boolean;
};

export const DEFAULT_SETTINGS_DATA: SettingsData = {
  ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  galleryLayout: 'grid',
  itemsPerPage: 12,
  enableLightbox: true,
  enableAnimations: true,
};

export function mapResponseToSettings(response: SettingsDataInput): SettingsData {
  return {
    ...mergeSettingsWithDefaults(response as Partial<GalleryBehaviorSettings>),
    theme: response.theme,
    galleryLayout: (response.galleryLayout as SettingsData['galleryLayout']) ?? DEFAULT_SETTINGS_DATA.galleryLayout,
    itemsPerPage: response.itemsPerPage ?? DEFAULT_SETTINGS_DATA.itemsPerPage,
    enableLightbox: response.enableLightbox ?? DEFAULT_SETTINGS_DATA.enableLightbox,
    enableAnimations: response.enableAnimations ?? DEFAULT_SETTINGS_DATA.enableAnimations,
  };
}

type SettingsDraftRecipe = (prev: SettingsData) => SettingsData;

interface SettingsDraftState {
  settings: SettingsData;
  originalSettings: SettingsData;
  hasChanges: boolean;
  applySettingsUpdate: (recipe: SettingsDraftRecipe) => void;
  hydrateFromSource: (loaded: SettingsData) => void;
  markSaved: (saved: SettingsData) => void;
  resetToOriginal: () => void;
}

function isComparableObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getComparableObjectEntries(value: Record<string, unknown>) {
  return Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
}

export function areSettingsValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => areSettingsValuesEqual(value, right[index]));
  }

  if (isComparableObject(left) || isComparableObject(right)) {
    if (!isComparableObject(left) || !isComparableObject(right)) {
      return false;
    }

    const leftEntries = getComparableObjectEntries(left);
    const rightEntries = getComparableObjectEntries(right);

    if (leftEntries.length !== rightEntries.length) {
      return false;
    }

    return leftEntries.every(([key, value]) => areSettingsValuesEqual(value, right[key]));
  }

  return false;
}

export function createSettingsDraftStore(initialSettings: SettingsData = DEFAULT_SETTINGS_DATA) {
  return createStore<SettingsDraftState>()((set) => ({
    settings: initialSettings,
    originalSettings: initialSettings,
    hasChanges: false,
    applySettingsUpdate: (recipe) => set((state) => {
      const nextSettings = recipe(state.settings);

      return {
        settings: nextSettings,
        hasChanges: !areSettingsValuesEqual(nextSettings, state.originalSettings),
      };
    }),
    hydrateFromSource: (loaded) => set((state) => ({
      settings: state.hasChanges ? state.settings : loaded,
      originalSettings: loaded,
      hasChanges: state.hasChanges && !areSettingsValuesEqual(state.settings, loaded),
    })),
    markSaved: (saved) => set({
      settings: saved,
      originalSettings: saved,
      hasChanges: false,
    }),
    resetToOriginal: () => set((state) => ({
      settings: state.originalSettings,
      hasChanges: false,
    })),
  }));
}