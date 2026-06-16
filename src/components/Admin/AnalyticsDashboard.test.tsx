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

// P34-A: stub visibility and online hooks so tests get deterministic polling
// state. They now live in the shared-utils barrel (P51-B), so spread the real
// module and override just these two.
vi.mock('@wp-super-gallery/shared-utils', async () => {
  const actual = await vi.importActual<typeof import('@wp-super-gallery/shared-utils')>('@wp-super-gallery/shared-utils');
  return {
    ...actual,
    useTabVisibility: vi.fn().mockReturnValue(true),
    useOnlineStatus: vi.fn().mockReturnValue(true),
  };
});

const mockAnalytics: CampaignAnalyticsResponse = {
  totalViews: 1200,
  uniqueVisitors: 430,
  daily: [
    { date: '2026-01-01', views: 100, unique: 40 },
    { date: '2026-01-02', views: 120, unique: 50 },
  ],
};

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getCampaignAnalytics: vi.fn().mockResolvedValue(mockAnalytics),
    getAnalyticsSummary: vi.fn().mockResolvedValue({
      totalViews: 5000,
      uniqueVisitors: 1800,
      topCampaigns: [],
    }),
    getCampaignMediaAnalytics: vi.fn().mockResolvedValue({ items: [] }),
    getBaseUrl: vi.fn().mockReturnValue('https://example.test'),
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
    // With no campaignId the query is disabled — no fetch, no chart.
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
      getCampaignAnalytics: vi.fn().mockResolvedValue({ totalViews: 0, uniqueVisitors: 0, daily: [] }),
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

  // ── P34-A: polling / refresh affordance ──────────────────────────────────

  it('renders the manual refresh button', () => {
    render(<AnalyticsDashboard apiClient={makeApiClient()} campaigns={campaigns} />);
    expect(screen.getByRole('button', { name: /refresh analytics/i })).toBeInTheDocument();
  });

  it('shows an Offline badge when the browser is offline', async () => {
    const { useOnlineStatus } = await import('@wp-super-gallery/shared-utils');
    vi.mocked(useOnlineStatus).mockReturnValue(false);

    render(<AnalyticsDashboard apiClient={makeApiClient()} campaigns={campaigns} />);
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('does not show Offline badge when the browser is online', async () => {
    // Explicitly (re)set to online so this test is independent of ordering
    const { useOnlineStatus } = await import('@wp-super-gallery/shared-utils');
    vi.mocked(useOnlineStatus).mockReturnValue(true);

    render(<AnalyticsDashboard apiClient={makeApiClient()} campaigns={campaigns} />);
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });

  it('clicking refresh calls all three analytics fetches', async () => {
    // Re-set online so this test is not affected by the offline-badge test above
    const { useOnlineStatus } = await import('@wp-super-gallery/shared-utils');
    vi.mocked(useOnlineStatus).mockReturnValue(true);

    const getCampaignAnalytics = vi.fn().mockResolvedValue(mockAnalytics);
    const getAnalyticsSummary = vi.fn().mockResolvedValue({
      totalViews: 5000, uniqueVisitors: 1800, topCampaigns: [],
    });
    const getCampaignMediaAnalytics = vi.fn().mockResolvedValue({ items: [] });

    render(
      // P53-A: the all-campaigns summary fetch/refetch is system-admin only.
      <AnalyticsDashboard
        apiClient={makeApiClient({ getCampaignAnalytics, getAnalyticsSummary, getCampaignMediaAnalytics })}
        campaigns={campaigns}
        isSystemAdmin
      />,
    );

    // Wait for data to be visible — confirms loading is done and the button is active
    await waitFor(() => expect(screen.getByText('1,200')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /refresh analytics/i }));

    await waitFor(() => expect(getCampaignAnalytics).toHaveBeenCalledTimes(2));
    expect(getAnalyticsSummary).toHaveBeenCalledTimes(2);
    expect(getCampaignMediaAnalytics).toHaveBeenCalledTimes(2);
  });

  it('does not fetch the all-campaigns summary for a non-system-admin (P53-A)', async () => {
    const getCampaignAnalytics = vi.fn().mockResolvedValue(mockAnalytics);
    const getAnalyticsSummary = vi.fn().mockResolvedValue({
      totalViews: 5000, uniqueVisitors: 1800, topCampaigns: [],
    });
    const getCampaignMediaAnalytics = vi.fn().mockResolvedValue({ items: [] });

    render(
      <AnalyticsDashboard
        apiClient={makeApiClient({ getCampaignAnalytics, getAnalyticsSummary, getCampaignMediaAnalytics })}
        campaigns={campaigns}
        isSystemAdmin={false}
      />,
    );

    await waitFor(() => expect(screen.getByText('1,200')).toBeInTheDocument());
    // Editor sees per-campaign stats but the summary endpoint is never hit.
    expect(getAnalyticsSummary).not.toHaveBeenCalled();
    expect(screen.queryByText(/all campaigns/i)).not.toBeInTheDocument();
  });
});
