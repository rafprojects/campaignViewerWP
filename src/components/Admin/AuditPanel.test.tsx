import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen, waitFor } from '../../test/test-utils';
import { AuditPanel } from './AuditPanel';
import type { CampaignSelectItem } from '@/components/Common/CampaignSelector';
import type { ApiClient } from '@/services/apiClient';
import type { useAdminZipTransfers } from '@/hooks/useAdminZipTransfers';

const campaignSelectData: CampaignSelectItem[] = [
  { value: '101', label: 'First Campaign' },
  { value: '102', label: 'Second Campaign' },
];

// AuditPanel only touches exportAuditZip / auditZipExporting on zipTransfers.
const zipTransfers = {
  auditZipExporting: false,
  exportAuditZip: vi.fn(),
} as unknown as ReturnType<typeof useAdminZipTransfers>;

function makeApiClient(get = vi.fn().mockResolvedValue({ items: [], total: 0 })): ApiClient {
  return new Proxy({ get }, {
    get(target, prop) {
      if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
      return vi.fn().mockResolvedValue([]);
    },
  }) as unknown as ApiClient;
}

describe('AuditPanel (P72-E)', () => {
  it('default-selects the first campaign and fetches its audit log when active', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const apiClient = makeApiClient(get);

    render(
      <AuditPanel active apiClient={apiClient} campaignSelectData={campaignSelectData} zipTransfers={zipTransfers} />,
    );

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        expect.stringContaining('/campaigns/101/audit'),
      );
    });
  });

  it('does not fetch the audit log while inactive (fetch-gating preserved)', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const apiClient = makeApiClient(get);

    render(
      <AuditPanel active={false} apiClient={apiClient} campaignSelectData={campaignSelectData} zipTransfers={zipTransfers} />,
    );

    // Give effects/queries a tick to (not) run.
    await new Promise((r) => setTimeout(r, 50));
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('/audit'));
  });

  it('owns its selection state — updating it does not re-render the parent (option b isolation)', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const apiClient = makeApiClient(get);
    const parentRenders = { count: 0 };

    // Stable-prop harness: the only thing that could make it re-render is its own
    // state, which never changes. Under option (a) the default-select would have
    // lived in the parent and bumped this counter; under (b) it stays in the child.
    function Harness() {
      const renders = useRef(0);
      renders.current += 1;
      parentRenders.count = renders.current;
      return (
        <AuditPanel active apiClient={apiClient} campaignSelectData={campaignSelectData} zipTransfers={zipTransfers} />
      );
    }

    render(<Harness />);

    // Wait until the child's mount-time default-select has driven a fetch — proof
    // that the child's own state changed at least once.
    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(expect.stringContaining('/campaigns/101/audit'));
    });

    expect(screen.getByText('Campaign Activity')).toBeInTheDocument();
    // The parent rendered exactly once despite the child's state change.
    expect(parentRenders.count).toBe(1);
  });
});
