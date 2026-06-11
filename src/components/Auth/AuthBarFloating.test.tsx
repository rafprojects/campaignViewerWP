import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { AuthBarFloating } from './AuthBarFloating';
import type { Campaign, Company, MediaItem } from '@/types';
import type { PageSpace } from '@/hooks/usePageSpaces';

type Win = typeof window & {
    __WPSG_PAGE_SPACES__?: PageSpace[];
    [key: string]: unknown;
};

const SPACE_A: PageSpace = { instanceId: 'space-a', id: 1, slug: 'hero', name: 'Hero Gallery' };
const SPACE_B: PageSpace = { instanceId: 'space-b', id: 2, slug: 'products', name: 'Products' };

function setSpaces(...spaces: PageSpace[]) {
    (window as Win).__WPSG_PAGE_SPACES__ = spaces;
}
function setOpener(instanceId: string, fn: (...args: unknown[]) => void) {
    (window as Win)[`__wpsgOpen_${instanceId}`] = fn;
}

afterEach(() => {
    delete (window as Win).__WPSG_PAGE_SPACES__;
    delete (window as Win)['__wpsgOpen_space-b'];
});

const company: Company = {
  id: 'acme',
  name: 'Acme',
  logo: 'AC',
  brandColor: '#123456',
};

const media: MediaItem = {
  id: 'm1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/image.jpg',
  order: 1,
};

const activeCampaign: Campaign = {
  id: '1',
  companyId: company.id,
  company,
  title: 'Private Campaign',
  description: 'Private description',
  thumbnail: 'https://example.com/thumb.jpg',
  coverImage: 'https://example.com/cover.jpg',
  videos: [],
  images: [media],
  tags: ['test'],
  status: 'active',
  visibility: 'private',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('AuthBarFloating', () => {
  it('shows the Edit Gallery Config action for an active admin campaign and calls the handler', async () => {
    const onEditGalleryConfig = vi.fn();

    render(
      <AuthBarFloating
        email="admin@example.com"
        isAdmin
        activeCampaign={activeCampaign}
        onEditGalleryConfig={onEditGalleryConfig}
        onOpenAdminPanel={() => undefined}
        onOpenSettings={() => undefined}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit gallery config for Private Campaign' }));

    expect(onEditGalleryConfig).toHaveBeenCalledWith(activeCampaign);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Edit gallery config for Private Campaign' })).not.toBeInTheDocument();
    });
  });
});

// ── Cross-space opener routing ────────────────────────────────────────────────
//
// SpaceSwitcher lives inside the Popover (withinPortal={false} → renders inline).
// After switching the target space, Settings and Admin Panel must call the target
// space's window opener, not the local prop handlers.

describe('AuthBarFloating — SpaceSwitcher presence', () => {
  it('shows SpaceSwitcher in the popover for admin + multi-space + instanceId', async () => {
    setSpaces(SPACE_A, SPACE_B);
    render(
      <AuthBarFloating
        email="admin@example.com"
        isAdmin
        isAuthenticated
        instanceId="space-a"
        onOpenAdminPanel={vi.fn()}
        onOpenSettings={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    expect(await screen.findByLabelText('Switch targeted gallery space')).toBeTruthy();
  });

  it('does NOT show SpaceSwitcher when instanceId is omitted', async () => {
    setSpaces(SPACE_A, SPACE_B);
    render(
      <AuthBarFloating
        email="admin@example.com"
        isAdmin
        isAuthenticated
        onOpenAdminPanel={vi.fn()}
        onOpenSettings={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    expect(screen.queryByLabelText('Switch targeted gallery space')).toBeNull();
  });
});

describe('AuthBarFloating — cross-space opener routing', () => {
  const floatingAdminProps = {
    email: 'admin@example.com',
    isAdmin: true,
    isAuthenticated: true as const,
    instanceId: 'space-a',
    onLogout: vi.fn(),
  };

  it('calls onOpenSettings directly when own space is active', async () => {
    setSpaces(SPACE_A);
    const onOpenSettings = vi.fn();
    render(
      <AuthBarFloating
        {...floatingAdminProps}
        onOpenAdminPanel={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    await userEvent.click(await screen.findByRole('button', { name: /settings/i }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('routes Settings to the target space opener after switching — NOT the local handler', async () => {
    setSpaces(SPACE_A, SPACE_B);
    const otherOpener = vi.fn();
    setOpener('space-b', otherOpener);
    const onOpenSettings = vi.fn();

    render(
      <AuthBarFloating
        {...floatingAdminProps}
        onOpenAdminPanel={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );

    // Open the floating popover
    await userEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    // Switch target space via SpaceSwitcher inside the popover
    await userEvent.click(await screen.findByLabelText('Switch targeted gallery space'));
    await userEvent.click(await screen.findByRole('menuitem', { name: /products/i }));
    // Click Settings — popover may have stayed open; if not, re-open it
    const settingsBtn = screen.queryByRole('button', { name: /^settings$/i });
    if (!settingsBtn) {
      await userEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    }
    await userEvent.click(await screen.findByRole('button', { name: /^settings$/i }));

    expect(otherOpener).toHaveBeenCalledWith('settings');
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  it('routes Admin Panel to the target space opener after switching — NOT the local handler', async () => {
    setSpaces(SPACE_A, SPACE_B);
    const otherOpener = vi.fn();
    setOpener('space-b', otherOpener);
    const onOpenAdminPanel = vi.fn();

    render(
      <AuthBarFloating
        {...floatingAdminProps}
        onOpenAdminPanel={onOpenAdminPanel}
        onOpenSettings={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    await userEvent.click(await screen.findByLabelText('Switch targeted gallery space'));
    await userEvent.click(await screen.findByRole('menuitem', { name: /products/i }));
    const adminBtn = screen.queryByRole('button', { name: /admin panel/i });
    if (!adminBtn) {
      await userEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    }
    await userEvent.click(await screen.findByRole('button', { name: /admin panel/i }));

    expect(otherOpener).toHaveBeenCalledWith('admin');
    expect(onOpenAdminPanel).not.toHaveBeenCalled();
  });
});
