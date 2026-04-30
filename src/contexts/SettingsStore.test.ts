import { describe, expect, it } from 'vitest';

import {
  areSettingsValuesEqual,
  createSettingsDraftStore,
  DEFAULT_SETTINGS_DATA,
} from './SettingsStore';

describe('SettingsStore', () => {
  it('tracks dirty draft updates with structural equality', () => {
    const store = createSettingsDraftStore({
      ...DEFAULT_SETTINGS_DATA,
      theme: 'default-dark',
      galleryConfig: {
        mode: 'per-type',
      },
    });

    store.getState().applySettingsUpdate((prev) => ({
      ...prev,
      theme: 'solarized-dark',
    }));

    expect(store.getState().hasChanges).toBe(true);

    store.getState().resetToOriginal();

    expect(store.getState().settings.theme).toBe('default-dark');
    expect(store.getState().hasChanges).toBe(false);
  });

  it('hydrates clean state from query data', () => {
    const store = createSettingsDraftStore({
      ...DEFAULT_SETTINGS_DATA,
      theme: 'default-dark',
    });

    store.getState().hydrateFromSource({
      ...DEFAULT_SETTINGS_DATA,
      theme: 'solarized-dark',
    });

    const state = store.getState();

    expect(state.settings.theme).toBe('solarized-dark');
    expect(state.originalSettings.theme).toBe('solarized-dark');
    expect(state.hasChanges).toBe(false);
  });

  it('preserves dirty draft state while updating the original source snapshot', () => {
    const store = createSettingsDraftStore({
      ...DEFAULT_SETTINGS_DATA,
      theme: 'default-dark',
    });

    store.getState().applySettingsUpdate((prev) => ({
      ...prev,
      theme: 'nord',
    }));

    store.getState().hydrateFromSource({
      ...DEFAULT_SETTINGS_DATA,
      theme: 'solarized-dark',
    });

    const state = store.getState();

    expect(state.settings.theme).toBe('nord');
    expect(state.originalSettings.theme).toBe('solarized-dark');
    expect(state.hasChanges).toBe(true);
  });

  it('marks saved state as clean and treats missing and undefined keys as equal', () => {
    const store = createSettingsDraftStore({
      ...DEFAULT_SETTINGS_DATA,
      theme: 'default-dark',
    });

    store.getState().applySettingsUpdate((prev) => ({
      ...prev,
      theme: undefined,
    }));

    expect(areSettingsValuesEqual({ theme: undefined }, {})).toBe(true);

    store.getState().markSaved({
      ...DEFAULT_SETTINGS_DATA,
      theme: 'solarized-dark',
    });

    const state = store.getState();

    expect(state.settings.theme).toBe('solarized-dark');
    expect(state.originalSettings.theme).toBe('solarized-dark');
    expect(state.hasChanges).toBe(false);
  });
});