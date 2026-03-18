import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { PendingRequestsPanel } from './PendingRequestsPanel';
import type { ApiClient, AccessRequest } from '@/services/apiClient';

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    listAccessRequests: vi.fn().mockResolvedValue([]),
    approveAccessRequest: vi.fn().mockResolvedValue(undefined),
    denyAccessRequest: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ApiClient;
}

const pendingRequest: AccessRequest = {
  token: 'tok-abc',
  email: 'alice@example.com',
  campaignId: 101,
  status: 'pending',
  requestedAt: '2026-01-15T10:00:00Z',
  resolvedAt: null,
};

const approvedRequest: AccessRequest = {
  token: 'tok-xyz',
  email: 'bob@example.com',
  campaignId: 101,
  status: 'approved',
  requestedAt: '2026-01-10T08:00:00Z',
  resolvedAt: '2026-01-11T09:00:00Z',
};

describe('PendingRequestsPanel', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows "Select a campaign" message when campaignId is empty', () => {
    render(
      <PendingRequestsPanel campaignId="" apiClient={makeApiClient()} />,
    );
    expect(screen.getByText(/select a campaign/i)).toBeInTheDocument();
  });

  it('shows empty-state message when no requests exist', async () => {
    render(
      <PendingRequestsPanel campaignId="101" apiClient={makeApiClient()} />,
    );
    await waitFor(() =>
      expect(screen.getByText(/no access requests/i)).toBeInTheDocument(),
    );
  });

  it('renders pending request with approve and deny buttons', async () => {
    const apiClient = makeApiClient({
      listAccessRequests: vi.fn().mockResolvedValue([pendingRequest]),
    });
    render(<PendingRequestsPanel campaignId="101" apiClient={apiClient} />);
    await waitFor(() =>
      expect(screen.getByText('alice@example.com')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument();
  });

  it('shows pending badge count', async () => {
    const apiClient = makeApiClient({
      listAccessRequests: vi.fn().mockResolvedValue([pendingRequest]),
    });
    render(<PendingRequestsPanel campaignId="101" apiClient={apiClient} />);
    await waitFor(() => expect(screen.getByText('1 pending')).toBeInTheDocument());
  });

  it('calls approveAccessRequest and re-fetches on Approve click', async () => {
    const approveAccessRequest = vi.fn().mockResolvedValue(undefined);
    const listAccessRequests = vi
      .fn()
      .mockResolvedValueOnce([pendingRequest])
      .mockResolvedValueOnce([]); // after mutate
    const apiClient = makeApiClient({ approveAccessRequest, listAccessRequests });
    render(<PendingRequestsPanel campaignId="101" apiClient={apiClient} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() =>
      expect(approveAccessRequest).toHaveBeenCalledWith('101', 'tok-abc'),
    );
  });

  it('calls denyAccessRequest on Deny click', async () => {
    const denyAccessRequest = vi.fn().mockResolvedValue(undefined);
    const apiClient = makeApiClient({
      listAccessRequests: vi.fn().mockResolvedValue([pendingRequest]),
      denyAccessRequest,
    });
    render(<PendingRequestsPanel campaignId="101" apiClient={apiClient} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /deny/i }));
    await waitFor(() =>
      expect(denyAccessRequest).toHaveBeenCalledWith('101', 'tok-abc'),
    );
  });

  it('shows error alert when approve fails', async () => {
    const apiClient = makeApiClient({
      listAccessRequests: vi.fn().mockResolvedValue([pendingRequest]),
      approveAccessRequest: vi.fn().mockRejectedValue(new Error('Server error')),
    });
    render(<PendingRequestsPanel campaignId="101" apiClient={apiClient} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument());
  });

  it('renders resolved requests section', async () => {
    const apiClient = makeApiClient({
      listAccessRequests: vi.fn().mockResolvedValue([approvedRequest]),
    });
    render(<PendingRequestsPanel campaignId="101" apiClient={apiClient} />);
    await waitFor(() =>
      expect(screen.getByText('bob@example.com')).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/resolved/i).length).toBeGreaterThan(0);
  });

  it('calls onMutate after successful action', async () => {
    const onMutate = vi.fn();
    const apiClient = makeApiClient({
      listAccessRequests: vi.fn().mockResolvedValue([pendingRequest]),
      approveAccessRequest: vi.fn().mockResolvedValue(undefined),
    });
    render(
      <PendingRequestsPanel campaignId="101" apiClient={apiClient} onMutate={onMutate} />,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => expect(onMutate).toHaveBeenCalledTimes(1));
  });
});
