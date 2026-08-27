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

  it('renders the apply-theme-everywhere switch off by default', () => {
    render(
      <SettingsAppearanceTab
        settings={DEFAULT_SETTINGS_DATA}
        updateSetting={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('switch', { name: /Apply gallery theme to editor/i });
    expect(toggle).not.toBeChecked();
  });
});
