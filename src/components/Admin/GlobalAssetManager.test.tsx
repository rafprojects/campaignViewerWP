import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { GlobalAssetManager } from './GlobalAssetManager';
import { ApiError } from '@/services/apiClient';

const mockAsset = {
  id: 'asset-1',
  url: 'https://example.com/overlay.png',
  name: 'My Asset',
  isUniversal: false,
  tags: [] as string[],
  uploadedAt: '2026-01-01T00:00:00.000Z',
};

function makeApiClient(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue([mockAsset]),
    postForm: vi.fn().mockResolvedValue({ ...mockAsset, id: 'asset-2', name: 'New Asset' }),
    post: vi.fn().mockResolvedValue({ id: mockAsset.id }),
    delete: vi.fn().mockResolvedValue({ deleted: true }),
    getBaseUrl: vi.fn().mockReturnValue('http://localhost'),
    ...overrides,
  } as any;
}

describe('GlobalAssetManager', () => {
  it('renders the title and upload button', async () => {
    render(<GlobalAssetManager apiClient={makeApiClient()} onNotify={vi.fn()} />);
    expect(await screen.findByText('Asset Library')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload asset/i })).toBeInTheDocument();
  });

  it('renders empty state when no assets exist', async () => {
    const apiClient = makeApiClient({ get: vi.fn().mockResolvedValue([]) });
    render(<GlobalAssetManager apiClient={apiClient} onNotify={vi.fn()} />);
    expect(await screen.findByText(/no design assets/i)).toBeInTheDocument();
  });

  it('renders asset grid after assets load', async () => {
    render(<GlobalAssetManager apiClient={makeApiClient()} onNotify={vi.fn()} />);
    // The asset image alt text matches the asset name.
    expect(await screen.findByAltText('My Asset')).toBeInTheDocument();
  });

  it('delete confirm → success path calls delete and notifies', async () => {
    const apiClient = makeApiClient();
    const onNotify = vi.fn();
    render(<GlobalAssetManager apiClient={apiClient} onNotify={onNotify} />);
    await screen.findByAltText('My Asset');

    // Click the delete (×) button on the asset card.
    fireEvent.click(screen.getByRole('button', { name: /delete My Asset/i }));

    // A confirm modal appears.
    const confirmBtn = await screen.findByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('asset-1'),
      ),
    );
    await waitFor(() =>
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' })),
    );
  });

  it('escalates a 409 in-use delete to force-confirm modal (P52-A5c)', async () => {
    const deleteFn = vi
      .fn()
      // First call (no force) returns 409.
      .mockRejectedValueOnce(new ApiError('in use', 409, { data: { status: 409, inUse: 2 } }))
      // Second call (force=true) succeeds.
      .mockResolvedValueOnce({ deleted: true });
    const apiClient = makeApiClient({ delete: deleteFn });
    const onNotify = vi.fn();

    render(<GlobalAssetManager apiClient={apiClient} onNotify={onNotify} />);
    await screen.findByAltText('My Asset');

    fireEvent.click(screen.getByRole('button', { name: /delete My Asset/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    // First delete fires (no force flag)…
    await waitFor(() => expect(deleteFn).toHaveBeenCalledTimes(1));

    // …and the in-use escalation modal appears (no error notification yet).
    expect(await screen.findByText(/associated with 2 space/i)).toBeInTheDocument();
    expect(onNotify).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));

    // Confirm force delete.
    fireEvent.click(screen.getByRole('button', { name: /delete anyway/i }));
    await waitFor(() => expect(deleteFn).toHaveBeenCalledTimes(2));

    // Second call must include ?force=true in the URL.
    expect(deleteFn.mock.calls[1][0]).toMatch(/force=true/);
    await waitFor(() =>
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' })),
    );
  });
});
