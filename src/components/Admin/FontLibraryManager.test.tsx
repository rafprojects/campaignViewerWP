/**
 * P50-J Tests: FontLibraryManager — universal toggle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import { FontLibraryManager } from './FontLibraryManager';
import type { ApiClient } from '@/services/apiClient';

const FONT_A = {
  id: 'fo-uuid-1',
  url: 'https://ex.com/a.woff2',
  name: 'Font Alpha',
  filename: 'a.woff2',
  format: 'woff2',
  uploadedAt: '2025-01-01',
  isUniversal: false,
};
const FONT_B = { ...FONT_A, id: 'fo-uuid-2', name: 'Font Beta', isUniversal: true };

function createMockApiClient(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue([FONT_A, FONT_B]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    postForm: vi.fn().mockResolvedValue({}),
    getBaseUrl: vi.fn().mockReturnValue('http://test'),
    getAuthHeaders: vi.fn().mockResolvedValue({}),
  } as unknown as ApiClient;
}

describe('FontLibraryManager — universal toggle', () => {
  let apiClient: ReturnType<typeof createMockApiClient>;

  beforeEach(() => {
    apiClient = createMockApiClient();
    vi.clearAllMocks();
  });

  it('renders an "All spaces" badge for universal fonts only', async () => {
    render(<FontLibraryManager apiClient={apiClient} />);
    await waitFor(() => expect(screen.getByText('Font Alpha')).toBeInTheDocument());
    expect(screen.getByText('All spaces')).toBeInTheDocument();
  });

  it('clicking the globe on a space-specific font POSTs is_universal: true', async () => {
    render(<FontLibraryManager apiClient={apiClient} />);
    await waitFor(() => expect(screen.getByText('Font Alpha')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Make Font Alpha available to all spaces/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/admin/font-library/fo-uuid-1'),
        { is_universal: true },
      );
    });
  });

  it('clicking the globe on a universal font POSTs is_universal: false', async () => {
    render(<FontLibraryManager apiClient={apiClient} />);
    await waitFor(() => expect(screen.getByText('Font Beta')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Make Font Beta space-specific/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/admin/font-library/fo-uuid-2'),
        { is_universal: false },
      );
    });
  });
});
