import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import type { ApiClient } from '@/services/apiClient';
import { SettingsCardsTab } from './SettingsCardsTab';
import { DEFAULT_SETTINGS_DATA } from '@/contexts/SettingsStore';

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getLayoutTemplates: vi.fn().mockResolvedValue([]),
    getBaseUrl: vi.fn().mockReturnValue('http://test'),
    ...overrides,
  } as unknown as ApiClient;
}

describe('SettingsCardsTab', () => {
  it('renders without error given valid settings', () => {
    render(
      <SettingsCardsTab
        settings={DEFAULT_SETTINGS_DATA}
        updateSetting={vi.fn()}
        apiClient={makeApiClient()}
        cardSettingsBreakpoint="desktop"
        setCardSettingsBreakpoint={vi.fn()}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Card settings breakpoint' })).toBeInTheDocument();
  });

  it('shows all three breakpoint options', () => {
    render(
      <SettingsCardsTab
        settings={DEFAULT_SETTINGS_DATA}
        updateSetting={vi.fn()}
        apiClient={makeApiClient()}
        cardSettingsBreakpoint="desktop"
        setCardSettingsBreakpoint={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Desktop' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tablet' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mobile' })).toBeInTheDocument();
  });
});
