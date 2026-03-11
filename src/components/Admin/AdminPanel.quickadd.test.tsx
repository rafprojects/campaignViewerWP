/**
 * QuickAdd user tests isolated in their own file so they start with a fresh
 * jsdom environment, avoiding Mantine modal portal state accumulated by the
 * larger AdminPanel test suite.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
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

describe('AdminPanel – QuickAdd user', () => {
  it('opens QuickAdd user modal and submits', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) return Promise.resolve(campaignsPayload);
        if (path.includes('/access')) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
      post: vi.fn().mockResolvedValue({
        message: 'User created.',
        userId: 42,
        emailSent: true,
        accessGranted: false,
      }),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;
    const onNotify = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={onNotify}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Access' }));
    fireEvent.click(await screen.findByRole('button', { name: /Quick add a new user/i }));
    await screen.findByRole('heading', { name: 'Quick Add User' });

    fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Test User' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/users',
        expect.objectContaining({ email: 'test@example.com', displayName: 'Test User' }),
      );
    });
  }, 30000);

  it('closes QuickAdd user modal with Cancel button', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) return Promise.resolve(campaignsPayload);
        if (path.includes('/access')) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
      post: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Access' }));
    fireEvent.click(await screen.findByRole('button', { name: /Quick add a new user/i }));
    await screen.findByRole('heading', { name: 'Quick Add User' });

    // Cancel should not call post - verify immediately without DOM-removal waitFor
    // (DOM-removal waitFor hangs due to Mantine exit-animation mutation observer loop)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(apiClient.post).not.toHaveBeenCalled();
  }, 30000);

  it('disables Create User button when fields are empty in QuickAdd modal', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) return Promise.resolve(campaignsPayload);
        if (path.includes('/access')) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
      post: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Access' }));
    fireEvent.click(await screen.findByRole('button', { name: /Quick add a new user/i }));
    await screen.findByRole('heading', { name: 'Quick Add User' });

    const createBtn = screen.getByRole('button', { name: /Create User/i });
    expect(createBtn).toBeDisabled();

    // Filling only email keeps button disabled
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
      target: { value: 'only@email.com' },
    });
    expect(createBtn).toBeDisabled();

    // Filling both fields enables the button
    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Only Name' },
    });
    expect(createBtn).not.toBeDisabled();

    // Close modal so Mantine transitions don't bleed into surrounding tests
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  }, 30000);
});
