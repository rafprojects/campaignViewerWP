import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import type { ApiClient, CampaignAnalyticsResponse } from '@/services/apiClient';

// recharts uses SVG/canvas APIs not available in jsdom. Replace all chart
// primitives with lightweight stubs so the component tree still renders.
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

const mockAnalytics: CampaignAnalyticsResponse = {
  total_views: 1200,
  unique_visitors: 430,
  daily: [
    { date: '2026-01-01', views: 100, unique: 40 },
    { date: '2026-01-02', views: 120, unique: 50 },
  ],
};

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getCampaignAnalytics: vi.fn().mockResolvedValue(mockAnalytics),
    ...overrides,
  } as unknown as ApiClient;
}

const campaigns = [
  { value: '101', label: 'Summer Drop' },
  { value: '102', label: 'Fall Lookbook' },
];

describe('AnalyticsDashboard', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders the dashboard heading', () => {
    render(<AnalyticsDashboard apiClient={makeApiClient()} campaigns={campaigns} />);
    expect(screen.getByText(/campaign analytics/i)).toBeInTheDocument();
  });

  it('shows empty state when no campaigns are provided', () => {
    render(<AnalyticsDashboard apiClient={makeApiClient()} campaigns={[]} />);
    // With no campaignId the SWR key is null — no fetch, no chart
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('fetches analytics for the first campaign on mount', async () => {
    const getCampaignAnalytics = vi.fn().mockResolvedValue(mockAnalytics);
    render(
      <AnalyticsDashboard
        apiClient={makeApiClient({ getCampaignAnalytics })}
        campaigns={campaigns}
      />,
    );
    await waitFor(() =>
      expect(getCampaignAnalytics).toHaveBeenCalledWith(
        '101',
        expect.stringMatching(/\d{4}-\d{2}-\d{2}/),
        expect.stringMatching(/\d{4}-\d{2}-\d{2}/),
      ),
    );
  });

  it('renders stat cards with totals after data loads', async () => {
    render(<AnalyticsDashboard apiClient={makeApiClient()} campaigns={campaigns} />);
    await waitFor(() =>
      expect(screen.getByText('1,200')).toBeInTheDocument(),
    );
    expect(screen.getByText('430')).toBeInTheDocument();
  });

  it('renders empty state when no view events recorded', async () => {
    const apiClient = makeApiClient({
      getCampaignAnalytics: vi.fn().mockResolvedValue({ total_views: 0, unique_visitors: 0, daily: [] }),
    });
    render(<AnalyticsDashboard apiClient={apiClient} campaigns={campaigns} />);
    await waitFor(() =>
      expect(screen.getByText(/no view events recorded/i)).toBeInTheDocument(),
    );
  });

  it('renders the line chart after data loads', async () => {
    render(<AnalyticsDashboard apiClient={makeApiClient()} campaigns={campaigns} />);
    await waitFor(() =>
      expect(screen.getByTestId('line-chart')).toBeInTheDocument(),
    );
  });

  it('shows an error alert when fetch fails', async () => {
    const apiClient = makeApiClient({
      getCampaignAnalytics: vi.fn().mockRejectedValue(new Error('Server error')),
    });
    render(<AnalyticsDashboard apiClient={apiClient} campaigns={campaigns} />);
    await waitFor(() =>
      expect(screen.getByText(/failed to load analytics data/i)).toBeInTheDocument(),
    );
  });

  it('changes date range when preset is switched', async () => {
    const getCampaignAnalytics = vi.fn().mockResolvedValue(mockAnalytics);
    render(
      <AnalyticsDashboard
        apiClient={makeApiClient({ getCampaignAnalytics })}
        campaigns={campaigns}
      />,
    );
    // Wait for initial load then switch to 7d
    await waitFor(() => expect(getCampaignAnalytics).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Last 7d'));
    await waitFor(() => expect(getCampaignAnalytics).toHaveBeenCalledTimes(2));
  });
});
