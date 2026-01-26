import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AdminPanel } from './AdminPanel';

const campaignsPayload = {
  items: [
    {
      id: '101',
      companyId: 'acme',
      title: 'Admin Campaign',
      description: 'Admin description',
      status: 'active',
      visibility: 'private',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      tags: [],
    },
  ],
};

describe('AdminPanel', () => {
  it('loads campaigns and supports access grant/revoke', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) {
          return Promise.resolve(campaignsPayload);
        }
        if (path.includes('/access')) {
          return Promise.resolve([
            {
              userId: '55',
              campaignId: '101',
              source: 'campaign',
              grantedAt: '2026-01-01T00:00:00.000Z',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      post: vi.fn().mockResolvedValue({ message: 'ok' }),
      delete: vi.fn().mockResolvedValue({ message: 'ok' }),
    } as any;

    const onNotify = vi.fn();

    render(
      <MantineProvider>
        <AdminPanel
          apiClient={apiClient}
          onClose={() => undefined}
          onCampaignsUpdated={() => undefined}
          onNotify={onNotify}
        />
      </MantineProvider>,
    );

    const campaignLabels = await screen.findAllByText('Admin Campaign');
    expect(campaignLabels.length).toBeGreaterThan(0);

    fireEvent.click(await screen.findByRole('tab', { name: 'Access' }));

    await waitFor(
      () => {
        expect(apiClient.get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/101/access');
      },
      { timeout: 10000 },
    );

    const userIdInput = await screen.findByLabelText('User ID');
    fireEvent.change(userIdInput, { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(
      () => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/wp-json/wp-super-gallery/v1/campaigns/101/access',
          expect.objectContaining({ userId: 42, source: 'campaign', action: 'grant' }),
        );
      },
      { timeout: 10000 },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke access' }));

    await waitFor(
      () => {
        expect(apiClient.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/101/access/55');
      },
      { timeout: 10000 },
    );
  }, 10000);
});
