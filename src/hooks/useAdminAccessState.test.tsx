import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminAccessState } from './useAdminAccessState';
import type { ApiClient } from '@/services/apiClient';
import type { CompanyAccessGrant } from './useAdminSWR';

// Mock @mantine/hooks so useDebouncedValue returns the value immediately
vi.mock('@mantine/hooks', () => ({
  useDebouncedValue: (value: unknown) => [value],
}));

// Mock useCombobox from @mantine/core.
// Without MantineProvider, useCombobox's internal store subscriptions re-run
// on every render, creating a new object → effect dep-array change → infinite
// rerender loop → V8 OOM crash. A stable mock object breaks the cycle.
vi.mock('@mantine/core', () => ({
  useCombobox: () => ({
    dropdownOpened: false,
    selectedOptionIndex: -1,
    focusedIndex: -1,
    openDropdown: vi.fn(),
    closeDropdown: vi.fn(),
    toggleDropdown: vi.fn(),
    selectOption: vi.fn(),
    selectFirstOption: vi.fn(),
    selectNextOption: vi.fn(),
    selectPreviousOption: vi.fn(),
    resetSelectedOption: vi.fn(),
    clickSelectedOption: vi.fn(),
    updateSelectedOptionIndex: vi.fn(),
    listId: '',
    setListId: vi.fn(),
    getSelectedOptionIndex: vi.fn().mockReturnValue(-1),
    onInputKeydown: vi.fn(),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({ users: [], total: 0 }),
    post: vi.fn().mockResolvedValue({ message: 'ok' }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ApiClient;
}

function makeBaseOptions(overrides: Record<string, unknown> = {}) {
  return {
    accessCampaignId: '101',
    selectedCompanyId: '',
    accessViewMode: 'campaign' as const,
    mutateAccess: vi.fn().mockResolvedValue(undefined),
    mutateCompanies: vi.fn().mockResolvedValue(undefined),
    mutateCampaigns: vi.fn().mockResolvedValue(undefined),
    onNotify: vi.fn(),
    ...overrides,
  };
}

const campaignAccessEntry: CompanyAccessGrant = {
  userId: 42,
  source: 'campaign',
  campaignId: 101,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAdminAccessState', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // IMPORTANT: apiClient MUST be created OUTSIDE the renderHook callback.
  // If created inside the callback, a new object is produced on every render,
  // changing the reference held by the search useEffect dep-array, which causes
  // setUserSearchResults([]) → re-render → new apiClient → ∞ loop → OOM crash.

  it('initialises with empty form state', () => {
    const apiClient = makeApiClient();
    const opts = makeBaseOptions();
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    expect(result.current.accessUserId).toBe('');
    expect(result.current.accessSaving).toBe(false);
    expect(result.current.userSearchResults).toEqual([]);
  });

  it('handleGrantAccess notifies error when no userId or selectedUser', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const opts = makeBaseOptions({ onNotify });
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    await act(async () => { await result.current.handleGrantAccess(); });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text: expect.stringMatching(/select a user/i) }),
    );
  });

  it('handleGrantAccess notifies error for invalid numeric userId', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const opts = makeBaseOptions({ onNotify });
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    act(() => { result.current.setAccessUserId('not-a-number'); });
    await act(async () => { await result.current.handleGrantAccess(); });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text: expect.stringMatching(/positive numeric/i) }),
    );
  });

  it('handleGrantAccess calls POST to campaign access endpoint', async () => {
    const post = vi.fn().mockResolvedValue({});
    const apiClient = makeApiClient({ post });
    const opts = makeBaseOptions();
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    act(() => { result.current.setAccessUserId('42'); });
    await act(async () => { await result.current.handleGrantAccess(); });
    expect(post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/101/access',
      expect.objectContaining({ userId: 42 }),
    );
  });

  it('handleGrantAccess resets form after success', async () => {
    const apiClient = makeApiClient();
    const opts = makeBaseOptions();
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    act(() => { result.current.setAccessUserId('42'); });
    await act(async () => { await result.current.handleGrantAccess(); });
    expect(result.current.accessUserId).toBe('');
    expect(result.current.selectedUser).toBeNull();
  });

  it('handleGrantAccess notifies error on API failure', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient({
      post: vi.fn().mockRejectedValue(new Error('Forbidden')),
    });
    const opts = makeBaseOptions({ onNotify });
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    act(() => { result.current.setAccessUserId('42'); });
    await act(async () => { await result.current.handleGrantAccess(); });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text: expect.stringMatching(/forbidden/i) }),
    );
  });

  it('handleRevokeAccess calls DELETE to campaign access endpoint', async () => {
    const deleteMethod = vi.fn().mockResolvedValue(undefined);
    const apiClient = makeApiClient({ delete: deleteMethod });
    const opts = makeBaseOptions();
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    await act(async () => { await result.current.handleRevokeAccess(campaignAccessEntry); });
    expect(deleteMethod).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/101/access/42',
    );
  });

  it('handleRevokeAccess notifies success after DELETE', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const opts = makeBaseOptions({ onNotify });
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    await act(async () => { await result.current.handleRevokeAccess(campaignAccessEntry); });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' }),
    );
  });

  it('handleQuickAddUser notifies error when email or name is empty', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const opts = makeBaseOptions({ onNotify });
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    await act(async () => { await result.current.handleQuickAddUser(); });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text: expect.stringMatching(/email and name/i) }),
    );
  });

  it('handleQuickAddUser calls POST and sets result on success with email sent', async () => {
    const post = vi.fn().mockResolvedValue({
      message: 'User created',
      userId: 55,
      emailSent: true,
      accessGranted: false,
      resetUrl: undefined,
    });
    const apiClient = makeApiClient({ post });
    const opts = makeBaseOptions();
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    act(() => {
      result.current.setQuickAddEmail('user@example.com');
      result.current.setQuickAddName('Test User');
    });
    await act(async () => { await result.current.handleQuickAddUser(); });
    expect(post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/users',
      expect.objectContaining({ email: 'user@example.com', displayName: 'Test User' }),
    );
    expect(result.current.quickAddResult).toMatchObject({
      success: true,
      message: expect.stringMatching(/email sent/i),
    });
  });

  it('handleQuickAddUser sets failed result on API error', async () => {
    const apiClient = makeApiClient({
      post: vi.fn().mockRejectedValue(new Error('Email exists')),
    });
    const opts = makeBaseOptions();
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    act(() => {
      result.current.setQuickAddEmail('user@example.com');
      result.current.setQuickAddName('Test User');
    });
    await act(async () => { await result.current.handleQuickAddUser(); });
    expect(result.current.quickAddResult).toMatchObject({
      success: false,
      message: expect.stringMatching(/email exists/i),
    });
  });

  it('user search fires GET after debounce when query >= 2 chars', async () => {
    const get = vi.fn().mockResolvedValue({
      users: [{ id: 1, email: 'a@b.com', displayName: 'Alice', login: 'alice', isAdmin: false }],
      total: 1,
    });
    const apiClient = makeApiClient({ get });
    const opts = makeBaseOptions();
    // useDebouncedValue is mocked to return the value immediately, so setting
    // the query triggers the search effect synchronously (within the next act).
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    act(() => { result.current.setUserSearchQuery('al'); });
    await waitFor(
      () => expect(get).toHaveBeenCalledWith(
        expect.stringContaining('/users/search'),
        expect.objectContaining({ signal: expect.anything() }),
      ),
      { timeout: 2000 },
    );
    await waitFor(() => {
      expect(result.current.userSearchResults).toHaveLength(1);
    }, { timeout: 2000 });
    expect(result.current.userSearchResults[0].displayName).toBe('Alice');
  });

  it('user search does not fire for queries shorter than 2 chars', async () => {
    const get = vi.fn().mockResolvedValue({ users: [], total: 0 });
    const apiClient = makeApiClient({ get });
    const opts = makeBaseOptions();
    const { result } = renderHook(
      () => useAdminAccessState({ apiClient, ...opts }),
    );
    act(() => { result.current.setUserSearchQuery('a'); });
    // Give enough time for any async effect to fire
    await new Promise(r => setTimeout(r, 450));
    expect(get).not.toHaveBeenCalled();
  });
});
