import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { RequestAccessForm } from './RequestAccessForm';
import type { ApiClient } from '@/services/apiClient';

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    submitAccessRequest: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ApiClient;
}

describe('RequestAccessForm', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders the campaign title and email input', () => {
    render(
      <RequestAccessForm
        campaignId="77"
        campaignTitle="Summer Showcase"
        apiClient={makeApiClient()}
      />,
    );
    expect(screen.getByText(/summer showcase/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('submit button calls submitAccessRequest with trimmed email', async () => {
    const apiClient = makeApiClient();
    render(
      <RequestAccessForm campaignId="77" campaignTitle="Test" apiClient={apiClient} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  user@example.com  ' } });
    fireEvent.click(screen.getByRole('button', { name: /request access/i }));
    await waitFor(() =>
      expect(apiClient.submitAccessRequest).toHaveBeenCalledWith('77', 'user@example.com'),
    );
  });

  it('shows success state after successful submission', async () => {
    render(
      <RequestAccessForm campaignId="77" campaignTitle="Test" apiClient={makeApiClient()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /request access/i }));
    await waitFor(() =>
      expect(screen.getByText(/check your email/i)).toBeInTheDocument(),
    );
  });

  it('shows error message after failed submission', async () => {
    const apiClient = makeApiClient({
      submitAccessRequest: vi.fn().mockRejectedValue(new Error('Rate limited')),
    });
    render(<RequestAccessForm campaignId="77" campaignTitle="Test" apiClient={apiClient} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /request access/i }));
    await waitFor(() => expect(screen.getByText(/rate limited/i)).toBeInTheDocument());
  });

  it('does not submit when email is blank', async () => {
    const submitAccessRequest = vi.fn();
    const apiClient = makeApiClient({ submitAccessRequest });
    render(<RequestAccessForm campaignId="77" campaignTitle="Test" apiClient={apiClient} />);
    fireEvent.click(screen.getByRole('button', { name: /request access/i }));
    await waitFor(() => expect(submitAccessRequest).not.toHaveBeenCalled());
  });

  it('shows loading state during submission', async () => {
    let resolveFn!: () => void;
    const apiClient = makeApiClient({
      submitAccessRequest: vi.fn(
        () => new Promise<void>((res) => { resolveFn = res; }),
      ),
    });
    render(<RequestAccessForm campaignId="77" campaignTitle="Test" apiClient={apiClient} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /request access/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /request access/i })).toHaveAttribute(
        'data-loading',
        'true',
      ),
    );
    resolveFn();
  });
});
