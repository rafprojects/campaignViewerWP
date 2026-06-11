import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpTransport } from '../http/HttpTransport';
import { CampaignsApi } from './campaignsApi';
import type { CampaignExportPayload } from './campaignsApi';

function makeMockTransport(overrides: Partial<HttpTransport> = {}): HttpTransport {
  return {
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('https://example.test'),
    getAuthHeaders: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe('CampaignsApi', () => {
  let transport: HttpTransport;
  let api: CampaignsApi;

  beforeEach(() => {
    transport = makeMockTransport();
    api = new CampaignsApi(transport);
  });

  describe('duplicateCampaign', () => {
    it('POSTs to the duplicate endpoint with defaults', async () => {
      vi.mocked(transport.post).mockResolvedValue({ id: '2', title: 'Copy' });
      const result = await api.duplicateCampaign('1', { name: 'Copy', copyMedia: true });
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/1/duplicate',
        { name: 'Copy', copyMedia: true, duplicateLayoutTemplate: false },
      );
      expect(result).toEqual({ id: '2', title: 'Copy' });
    });
  });

  describe('deleteCampaign', () => {
    it('DELETEs with confirm=true', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ message: 'deleted', id: 1 });
      await api.deleteCampaign('1');
      expect(transport.delete).toHaveBeenCalledWith(
        expect.stringContaining('/campaigns/1?confirm=true'),
      );
    });

    it('appends purge_analytics when requested', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ message: 'deleted', id: 1 });
      await api.deleteCampaign('1', { purgeAnalytics: true });
      expect(transport.delete).toHaveBeenCalledWith(
        expect.stringContaining('purge_analytics=true'),
      );
    });
  });

  describe('batchCampaigns', () => {
    it('POSTs archive action without confirm', async () => {
      vi.mocked(transport.post).mockResolvedValue({ success: ['1'], failed: [] });
      await api.batchCampaigns('archive', ['1', '2']);
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/batch',
        { action: 'archive', ids: ['1', '2'] },
      );
    });

    it('includes confirm=true for delete action', async () => {
      vi.mocked(transport.post).mockResolvedValue({ success: ['1'], failed: [] });
      await api.batchCampaigns('delete', ['1']);
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/batch',
        expect.objectContaining({ action: 'delete', confirm: true }),
      );
    });
  });

  describe('addCampaignMediaBatch', () => {
    it('POSTs to the media batch endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ added: [], skipped: [] });
      await api.addCampaignMediaBatch('42', []);
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/42/media/batch',
        { items: [] },
      );
    });
  });

  describe('exportCampaign', () => {
    it('GETs the export endpoint', async () => {
      const payload: CampaignExportPayload = {
        version: 1,
        exported_at: '2024-01-01',
        campaign: {},
        layout_template: null,
        media_references: [],
      };
      vi.mocked(transport.get).mockResolvedValue(payload);
      const result = await api.exportCampaign('5');
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/5/export',
      );
      expect(result).toEqual(payload);
    });
  });

  describe('importCampaign', () => {
    it('POSTs payload to the import endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ id: 99 });
      const payload: CampaignExportPayload = {
        version: 1,
        exported_at: '2024-01-01',
        campaign: {},
        layout_template: null,
        media_references: [],
      };
      await api.importCampaign(payload);
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/import',
        payload,
      );
    });
  });

  describe('importCampaignBinary', () => {
    it('sends FormData via postForm', async () => {
      vi.mocked(transport.postForm).mockResolvedValue({ imported: [] });
      const file = new File(['data'], 'campaign.zip');
      await api.importCampaignBinary(file);
      expect(transport.postForm).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/import/binary',
        expect.any(FormData),
      );
    });
  });

  describe('listCampaignCategories', () => {
    it('returns the items array', async () => {
      vi.mocked(transport.get).mockResolvedValue({
        items: [{ id: '1', name: 'Cat', slug: 'cat', count: 3, parent_id: 0 }],
      });
      const result = await api.listCampaignCategories();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Cat');
    });

    it('returns empty array when items is absent', async () => {
      vi.mocked(transport.get).mockResolvedValue({});
      expect(await api.listCampaignCategories()).toEqual([]);
    });
  });

  describe('createCampaignCategory', () => {
    it('POSTs name to categories endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ id: '1', name: 'New', slug: 'new', count: 0, parent_id: 0 });
      await api.createCampaignCategory('New');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaign-categories',
        { name: 'New' },
      );
    });
  });

  describe('updateCampaignCategory', () => {
    it('PUTs updated data to category endpoint', async () => {
      vi.mocked(transport.put).mockResolvedValue({ id: '1', name: 'Updated', slug: 'updated', count: 0, parent_id: 0 });
      await api.updateCampaignCategory('1', { name: 'Updated' });
      expect(transport.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaign-categories/1',
        { name: 'Updated' },
      );
    });
  });

  describe('deleteCampaignCategory', () => {
    it('DELETEs category by id', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ deleted: true, id: '1' });
      await api.deleteCampaignCategory('1');
      expect(transport.delete).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaign-categories/1',
      );
    });
  });

  describe('listCampaignTags', () => {
    it('returns items array', async () => {
      vi.mocked(transport.get).mockResolvedValue({
        items: [{ id: 1, name: 'Tag', slug: 'tag', count: 1 }],
      });
      const result = await api.listCampaignTags();
      expect(result).toHaveLength(1);
    });

    it('returns empty array when items absent', async () => {
      vi.mocked(transport.get).mockResolvedValue({});
      expect(await api.listCampaignTags()).toEqual([]);
    });
  });

  describe('createCampaignTag', () => {
    it('POSTs name to campaign tags endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ id: 1, name: 'T', slug: 't', count: 0 });
      await api.createCampaignTag('T');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/tags/campaign',
        { name: 'T' },
      );
    });
  });

  describe('deleteCampaignTag', () => {
    it('DELETEs campaign tag by id', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ deleted: true, id: '1' });
      await api.deleteCampaignTag('1');
      expect(transport.delete).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/tags/campaign/1',
      );
    });
  });

  describe('listCampaignTemplates', () => {
    it('returns items array', async () => {
      vi.mocked(transport.get).mockResolvedValue({
        items: [{ id: '1', name: 'T', description: '', source: 'user', editable: true, settings: { visibility: 'public', galleryOverrides: null, layoutTemplateId: null }, createdAt: null }],
      });
      expect(await api.listCampaignTemplates()).toHaveLength(1);
    });
  });

  describe('createCampaignTemplate', () => {
    it('POSTs to campaign templates endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ id: '1', name: 'T', description: '', source: 'user', editable: true, settings: { visibility: 'public', galleryOverrides: null, layoutTemplateId: null }, createdAt: null });
      await api.createCampaignTemplate({ name: 'T' });
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaign-templates',
        { name: 'T' },
      );
    });
  });

  describe('deleteCampaignTemplate', () => {
    it('DELETEs template by id', async () => {
      vi.mocked(transport.delete).mockResolvedValue(undefined);
      await api.deleteCampaignTemplate('1');
      expect(transport.delete).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaign-templates/1',
      );
    });
  });

  describe('listMediaTags', () => {
    it('returns items array', async () => {
      vi.mocked(transport.get).mockResolvedValue({
        items: [{ id: 1, name: 'MT', slug: 'mt', count: 0 }],
      });
      expect(await api.listMediaTags()).toHaveLength(1);
    });
  });

  describe('createMediaTag', () => {
    it('POSTs to media tags endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ id: 1, name: 'MT', slug: 'mt', count: 0 });
      await api.createMediaTag('MT');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/tags/media',
        { name: 'MT' },
      );
    });
  });

  describe('deleteMediaTag', () => {
    it('DELETEs media tag by id', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ deleted: true, id: '1' });
      await api.deleteMediaTag('1');
      expect(transport.delete).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/tags/media/1',
      );
    });
  });

  describe('submitAccessRequest', () => {
    it('POSTs email to access-requests endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ message: 'ok', token: 'abc' });
      await api.submitAccessRequest('5', 'user@example.com');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/5/access-requests',
        { email: 'user@example.com' },
      );
    });
  });

  describe('listAccessRequests', () => {
    it('returns array response directly', async () => {
      const items = [{ token: 't1', email: 'a@b.com', campaignId: 1, status: 'pending' as const, requestedAt: '', resolvedAt: null }];
      vi.mocked(transport.get).mockResolvedValue(items);
      expect(await api.listAccessRequests('5')).toEqual(items);
    });

    it('unwraps items from object response', async () => {
      const items = [{ token: 't1', email: 'a@b.com', campaignId: 1, status: 'approved' as const, requestedAt: '', resolvedAt: null }];
      vi.mocked(transport.get).mockResolvedValue({ items });
      expect(await api.listAccessRequests('5')).toEqual(items);
    });

    it('returns empty array for unrecognised shape', async () => {
      vi.mocked(transport.get).mockResolvedValue({});
      expect(await api.listAccessRequests('5')).toEqual([]);
    });

    it('appends status filter to query string', async () => {
      vi.mocked(transport.get).mockResolvedValue([]);
      await api.listAccessRequests('5', 'pending');
      expect(transport.get).toHaveBeenCalledWith(expect.stringContaining('status=pending'));
    });
  });

  describe('approveAccessRequest', () => {
    it('POSTs to approve endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ message: 'approved' });
      await api.approveAccessRequest('5', 'tok1');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/5/access-requests/tok1/approve',
        {},
      );
    });
  });

  describe('denyAccessRequest', () => {
    it('POSTs to deny endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ message: 'denied' });
      await api.denyAccessRequest('5', 'tok1');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/5/access-requests/tok1/deny',
        {},
      );
    });
  });

  describe('getAccessSummary', () => {
    it('GETs with default pagination', async () => {
      vi.mocked(transport.get).mockResolvedValue({ items: [], page: 1, perPage: 50, total: 0, totalPages: 0 });
      await api.getAccessSummary();
      expect(transport.get).toHaveBeenCalledWith(
        expect.stringContaining('page=1&per_page=50'),
      );
    });

    it('passes custom page and perPage', async () => {
      vi.mocked(transport.get).mockResolvedValue({ items: [], page: 2, perPage: 10, total: 0, totalPages: 0 });
      await api.getAccessSummary(2, 10);
      expect(transport.get).toHaveBeenCalledWith(
        expect.stringContaining('page=2&per_page=10'),
      );
    });
  });
});
