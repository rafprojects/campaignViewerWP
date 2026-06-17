/**
 * Branch-coverage tests for useAdminAccessState (hand-authored).
 * Covers the grant/revoke/role-change/archive/quick-add handler branches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminAccessState, type AccessViewMode } from './useAdminAccessState';

function makeApi(over: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue({ users: [], total: 0 }),
    post: vi.fn().mockResolvedValue({ archivedCount: 3, emailSent: true, accessGranted: true, userId: 9, message: 'ok' }),
    delete: vi.fn().mockResolvedValue({}),
    ...over,
  };
}

function setup(props: {
  api?: ReturnType<typeof makeApi>;
  accessCampaignId?: string;
  selectedCompanyId?: string;
  accessViewMode?: AccessViewMode;
} = {}) {
  const api = props.api ?? makeApi();
  const mutateAccess = vi.fn().mockResolvedValue(undefined);
  const mutateCompanies = vi.fn().mockResolvedValue(undefined);
  const mutateCampaigns = vi.fn().mockResolvedValue(undefined);
  const onNotify = vi.fn();
  const hook = renderHook(() =>
    useAdminAccessState({
      apiClient: api as never,
      accessCampaignId: props.accessCampaignId ?? '5',
      selectedCompanyId: props.selectedCompanyId ?? '',
      accessViewMode: props.accessViewMode ?? 'campaign',
      mutateAccess,
      mutateCompanies,
      mutateCampaigns,
      onNotify,
    }),
  );
  return { hook, api, mutateAccess, mutateCompanies, mutateCampaigns, onNotify };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('handleGrantAccess', () => {
  it('guards missing campaign/company target', async () => {
    const noCampaign = setup({ accessCampaignId: '' });
    await act(async () => { await noCampaign.hook.result.current.handleGrantAccess(); });
    expect(noCampaign.api.post).not.toHaveBeenCalled();

    const noCompany = setup({ accessViewMode: 'company', selectedCompanyId: '' });
    await act(async () => { await noCompany.hook.result.current.handleGrantAccess(); });
    expect(noCompany.api.post).not.toHaveBeenCalled();
  });

  it('requires a user, and rejects a non-positive numeric id', async () => {
    const { hook, onNotify, api } = setup();
    await act(async () => { await hook.result.current.handleGrantAccess(); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'error', text: 'Please select a user or enter a User ID.' });

    act(() => hook.result.current.setAccessUserId('-3'));
    await act(async () => { await hook.result.current.handleGrantAccess(); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'error', text: 'User ID must be a positive numeric value.' });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('grants on a campaign with a numeric id, level and expiry', async () => {
    const { hook, api, mutateAccess } = setup();
    act(() => {
      hook.result.current.setAccessUserId('42');
      hook.result.current.setAccessLevel('viewer');
      hook.result.current.setExpiresAt('2030-01-01');
    });
    await act(async () => { await hook.result.current.handleGrantAccess(); });
    expect(api.post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/5/access',
      expect.objectContaining({ userId: 42, access_level: 'viewer', expires_at: '2030-01-01' }),
    );
    expect(mutateAccess).toHaveBeenCalled();
  });

  it('omits access_level for a deny action and uses the selected user', async () => {
    const { hook, api } = setup();
    act(() => {
      hook.result.current.setSelectedUser({ id: 7, email: 'a@b.c', displayName: 'A', login: 'a', isAdmin: false });
      hook.result.current.setAccessAction('deny');
    });
    await act(async () => { await hook.result.current.handleGrantAccess(); });
    const body = api.post.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.userId).toBe(7);
    expect(body).not.toHaveProperty('access_level');
  });

  it('grants company access in company mode', async () => {
    const { hook, api } = setup({ accessViewMode: 'company', selectedCompanyId: '3' });
    act(() => hook.result.current.setAccessUserId('8'));
    await act(async () => { await hook.result.current.handleGrantAccess(); });
    expect(api.post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/companies/3/access',
      expect.objectContaining({ userId: 8 }),
    );
  });

  it('notifies on a grant error', async () => {
    const { hook, onNotify } = setup({ api: makeApi({ post: vi.fn().mockRejectedValue(new Error('x')) }) });
    act(() => hook.result.current.setAccessUserId('8'));
    await act(async () => { await hook.result.current.handleGrantAccess(); });
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('handleRevokeAccess', () => {
  it('revokes a campaign grant', async () => {
    const { hook, api } = setup();
    await act(async () => { await hook.result.current.handleRevokeAccess({ userId: 4, source: 'campaign' } as never); });
    expect(api.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/5/access/4');
  });

  it('revokes a company grant and a campaign-source grant in company mode', async () => {
    const { hook, api } = setup({ accessViewMode: 'company', selectedCompanyId: '3' });
    await act(async () => { await hook.result.current.handleRevokeAccess({ userId: 4, source: 'company' } as never); });
    expect(api.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/companies/3/access/4');
    await act(async () => { await hook.result.current.handleRevokeAccess({ userId: 6, source: 'campaign', campaignId: '99' } as never); });
    expect(api.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/99/access/6');
  });

  it('notifies on a revoke error', async () => {
    const { hook, onNotify } = setup({ api: makeApi({ delete: vi.fn().mockRejectedValue(new Error('x')) }) });
    await act(async () => { await hook.result.current.handleRevokeAccess({ userId: 4, source: 'campaign' } as never); });
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('handleChangeRole', () => {
  it('no-ops when the level is unchanged', async () => {
    const { hook, api } = setup();
    await act(async () => { await hook.result.current.handleChangeRole({ userId: 4, source: 'campaign', access_level: 'viewer' } as never, 'viewer'); });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('changes a campaign-mode role and preserves expiry', async () => {
    const { hook, api } = setup();
    await act(async () => {
      await hook.result.current.handleChangeRole(
        { userId: 4, source: 'campaign', access_level: 'viewer', expires_at: '2031-01-01' } as never,
        'editor',
      );
    });
    expect(api.post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/5/access',
      expect.objectContaining({ userId: 4, access_level: 'editor', expires_at: '2031-01-01' }),
    );
  });

  it('changes a company-source role in company mode and reports errors', async () => {
    const { hook, api } = setup({ accessViewMode: 'company', selectedCompanyId: '3' });
    await act(async () => { await hook.result.current.handleChangeRole({ userId: 4, source: 'company', access_level: 'viewer' } as never, 'owner'); });
    expect(api.post).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/companies/3/access', expect.objectContaining({ access_level: 'owner' }));

    const err = setup({ api: makeApi({ post: vi.fn().mockRejectedValue(new Error('x')) }) });
    await act(async () => { await err.hook.result.current.handleChangeRole({ userId: 4, source: 'campaign', access_level: 'viewer' } as never, 'editor'); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('handleArchiveCompany', () => {
  it('returns without a staged company', async () => {
    const { hook, api } = setup();
    await act(async () => { await hook.result.current.handleArchiveCompany(); });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('archives and reports the count', async () => {
    const { hook, onNotify } = setup({ selectedCompanyId: '3' });
    act(() => hook.result.current.setConfirmArchiveCompany({ id: '3', name: 'Co' } as never));
    await act(async () => { await hook.result.current.handleArchiveCompany(); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: 'Archived 3 campaigns.' });
  });

  it('reports an archive error', async () => {
    const { hook, onNotify } = setup({ api: makeApi({ post: vi.fn().mockRejectedValue(new Error('x')) }) });
    act(() => hook.result.current.setConfirmArchiveCompany({ id: '3', name: 'Co' } as never));
    await act(async () => { await hook.result.current.handleArchiveCompany(); });
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('quick-add user', () => {
  it('requires email and name', async () => {
    const { hook, onNotify } = setup();
    await act(async () => { await hook.result.current.handleQuickAddUser(); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'error', text: 'Email and name are required.' });
  });

  it('creates a user (email sent) and clears the form', async () => {
    const { hook } = setup();
    act(() => { hook.result.current.setQuickAddEmail('a@b.c'); hook.result.current.setQuickAddName('A'); });
    await act(async () => { await hook.result.current.handleQuickAddUser(); });
    expect(hook.result.current.quickAddResult?.success).toBe(true);
    expect(hook.result.current.quickAddEmail).toBe('');
  });

  it('surfaces a reset URL when no email was sent', async () => {
    const api = makeApi({ post: vi.fn().mockResolvedValue({ emailSent: false, message: 'manual', resetUrl: 'http://r', accessGranted: false }) });
    const { hook } = setup({ api });
    act(() => { hook.result.current.setQuickAddEmail('a@b.c'); hook.result.current.setQuickAddName('A'); });
    await act(async () => { await hook.result.current.handleQuickAddUser(); });
    expect(hook.result.current.quickAddResult).toMatchObject({ success: true, resetUrl: 'http://r' });
  });

  it('records a failure result on error', async () => {
    const { hook } = setup({ api: makeApi({ post: vi.fn().mockRejectedValue(new Error('x')) }) });
    act(() => { hook.result.current.setQuickAddEmail('a@b.c'); hook.result.current.setQuickAddName('A'); });
    await act(async () => { await hook.result.current.handleQuickAddUser(); });
    expect(hook.result.current.quickAddResult?.success).toBe(false);
  });

  it('open prefills campaign id; close resets', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleOpenQuickAddUser());
    expect(hook.result.current.quickAddCampaignId).toBe('5');
    expect(hook.result.current.quickAddUserOpen).toBe(true);
    act(() => hook.result.current.closeQuickAddUser());
    expect(hook.result.current.quickAddUserOpen).toBe(false);
    expect(hook.result.current.quickAddCampaignId).toBe('');
  });
});

describe('user search effect', () => {
  it('searches after the debounce for a 2+ char query', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue({ users: [{ id: 1, email: 'a', displayName: 'A', login: 'a', isAdmin: false }], total: 1 }) });
    const { hook } = setup({ api });
    act(() => hook.result.current.setUserSearchQuery('bo'));
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('search=bo'), expect.anything());
  });
});
