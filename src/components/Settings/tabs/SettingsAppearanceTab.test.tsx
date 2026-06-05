import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { SettingsAppearanceTab } from './SettingsAppearanceTab';
import { DEFAULT_SETTINGS_DATA } from '@/contexts/SettingsStore';

describe('SettingsAppearanceTab', () => {
  it('renders without error given valid settings', () => {
    render(
      <SettingsAppearanceTab
        settings={DEFAULT_SETTINGS_DATA}
        updateSetting={vi.fn()}
      />,
    );
    expect(screen.getByText('Theme & Layout')).toBeInTheDocument();
  });
});
