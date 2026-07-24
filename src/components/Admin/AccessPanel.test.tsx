import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen, waitFor } from '../../test/test-utils';
import { AccessPanel } from './AccessPanel';
import type { CampaignSelectItem } from '@/components/Common/CampaignSelector';
import type { AdminCampaign } from '@/services/adminQuery';
import type { ApiClient } from '@/services/apiClient';

const allCampaigns = [
  { id: '101', title: 'First Campaign', companyId: 'acme', status: 'active' },
  { id: '102', title: 'Second Campaign', companyId: 'beta', status: 'active' },
] as unknown as AdminCampaign[];

const campaignSelectData: CampaignSelectItem[] = [
  { value: '101', label: 'First Campaign' },
  { value: '102', label: 'Second Campaign' },
];

function makeApiClient(get = vi.fn().mockResolvedValue({ items: [], total: 0 })): ApiClient {
  return new Proxy({ get }, {
    get(target, prop) {
      if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
      return vi.fn().mockResolvedValue([]);
    },
  }) as unknown as ApiClient;
}

const baseProps = {
  apiClient: makeApiClient(),
  selectedSpaceId: 'all',
  allCampaigns,
  campaignSelectData,
  campaigns: [] as AdminCampaign[],
  campaignsMutator: vi.fn().mockResolvedValue(undefined),
  onNotify: vi.fn(),
  isMobile: false,
  isSystemAdmin: true,
};

describe('AccessPanel (P72-E)', () => {
  it('default-selects the first campaign and fetches its access grants when active', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const apiClient = makeApiClient(get);

    render(<AccessPanel {...baseProps} active apiClient={apiClient} />);

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        expect.stringContaining('/campaigns/101/access'),
      );
    });
  });

  it('does not fetch access grants while inactive (fetch-gating preserved)', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const apiClient = makeApiClient(get);

    render(<AccessPanel {...baseProps} active={false} apiClient={apiClient} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('/access'));
  });

  it('owns its selection state — updating it does not re-render the parent (option b isolation)', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const apiClient = makeApiClient(get);
    const parentRenders = { count: 0 };

    function Harness() {
      const renders = useRef(0);
      renders.current += 1;
      parentRenders.count = renders.current;
      return <AccessPanel {...baseProps} active apiClient={apiClient} />;
    }

    render(<Harness />);

    // The child's mount-time default-select drives an access-grants fetch — proof
    // its own state changed at least once.
    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(expect.stringContaining('/campaigns/101/access'));
    });

    expect(screen.getByText('View By')).toBeInTheDocument();
    // The parent rendered exactly once despite the child's state change.
    expect(parentRenders.count).toBe(1);
  });
});
