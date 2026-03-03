import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { MediaUsageBadge } from './MediaUsageBadge';
import type { ApiClient } from '@/services/apiClient';

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getMediaUsage: vi.fn().mockResolvedValue({ campaigns: [] }),
    ...overrides,
  } as unknown as ApiClient;
}

describe('MediaUsageBadge', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders "X campaigns" badge for count > 1', () => {
    render(<MediaUsageBadge count={3} mediaId="m1" apiClient={makeApiClient()} />);
    expect(screen.getByText('3 campaigns')).toBeInTheDocument();
  });

  it('renders "1 campaign" for count === 1', () => {
    render(<MediaUsageBadge count={1} mediaId="m1" apiClient={makeApiClient()} />);
    expect(screen.getByText('1 campaign')).toBeInTheDocument();
  });

  it('renders "Unused" badge when count is 0', () => {
    render(<MediaUsageBadge count={0} mediaId="m1" apiClient={makeApiClient()} />);
    expect(screen.getByText('Unused')).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    render(<MediaUsageBadge count={2} mediaId="m1" apiClient={makeApiClient()} />);
    expect(screen.getByLabelText(/media used in/i)).toBeInTheDocument();
  });

  it('calls getMediaUsage on first badge click and shows campaign list', async () => {
    const apiClient = makeApiClient({
      getMediaUsage: vi.fn().mockResolvedValue({
        campaigns: [
          { id: '10', title: 'Spring Drop' },
          { id: '11', title: 'Fall Lookbook' },
        ],
      }),
    });
    render(<MediaUsageBadge count={2} mediaId="m1" apiClient={apiClient} />);
    fireEvent.click(screen.getByText('2 campaigns'));
    await waitFor(() => expect(screen.getByText('Spring Drop')).toBeInTheDocument());
    expect(screen.getByText('Fall Lookbook')).toBeInTheDocument();
    expect(apiClient.getMediaUsage).toHaveBeenCalledWith('m1');
  });

  it('shows "Not used in any campaign" when detail returns empty list', async () => {
    render(<MediaUsageBadge count={0} mediaId="m1" apiClient={makeApiClient()} />);
    fireEvent.click(screen.getByText('Unused'));
    await waitFor(() =>
      expect(screen.getByText(/not used in any campaign/i)).toBeInTheDocument(),
    );
  });

  it('shows error when getMediaUsage fails', async () => {
    const apiClient = makeApiClient({
      getMediaUsage: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    render(<MediaUsageBadge count={1} mediaId="m1" apiClient={apiClient} />);
    fireEvent.click(screen.getByText('1 campaign'));
    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
  });

  it('does not call getMediaUsage again on second open (cached)', async () => {
    const getMediaUsage = vi.fn().mockResolvedValue({ campaigns: [] });
    const apiClient = makeApiClient({ getMediaUsage });
    render(<MediaUsageBadge count={1} mediaId="m2" apiClient={apiClient} />);
    // Open once
    fireEvent.click(screen.getByText('1 campaign'));
    await waitFor(() => expect(getMediaUsage).toHaveBeenCalledTimes(1));
    // Close and re-open
    fireEvent.click(screen.getByText('1 campaign'));
    fireEvent.click(screen.getByText('1 campaign'));
    await waitFor(() => expect(getMediaUsage).toHaveBeenCalledTimes(1));
  });
});
