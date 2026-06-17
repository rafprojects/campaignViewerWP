/**
 * Delegation coverage for the ApiClient facade.
 *
 * ApiClient is a thin facade (P32-C) — each public method forwards to a domain
 * sub-API instance. These tests spy on each sub-API method and assert the facade
 * forwards the same arguments and returns the sub-API's result, exercising every
 * delegation method.
 */
import { describe, it, expect, vi } from 'vitest';
import { ApiClient } from './apiClient';

const baseUrl = 'https://example.test';

// [facade method, private sub-API field, sub-API method, args]
const cases: Array<[keyof ApiClient, string, string, unknown[]]> = [
  // Settings
  ['getSettings', '_settings', 'getSettings', [5]],
  ['updateSettings', '_settings', 'updateSettings', [{ theme: 'dark' }]],
  ['testConnection', '_settings', 'testConnection', []],
  // Layout templates
  ['getLayoutTemplates', '_layoutTemplates', 'getLayoutTemplates', []],
  ['getLayoutTemplate', '_layoutTemplates', 'getLayoutTemplate', ['t1']],
  ['createLayoutTemplate', '_layoutTemplates', 'createLayoutTemplate', [{ name: 'x' }]],
  ['updateLayoutTemplate', '_layoutTemplates', 'updateLayoutTemplate', ['t1', { name: 'y' }]],
  ['deleteLayoutTemplate', '_layoutTemplates', 'deleteLayoutTemplate', ['t1', true]],
  ['duplicateLayoutTemplate', '_layoutTemplates', 'duplicateLayoutTemplate', ['t1', 'copy']],
  ['getLayoutTemplatePublic', '_layoutTemplates', 'getLayoutTemplatePublic', ['t1']],
  // Analytics
  ['recordAnalyticsEvent', '_analytics', 'recordAnalyticsEvent', ['c1', 'view', 'm1']],
  ['getCampaignAnalytics', '_analytics', 'getCampaignAnalytics', ['c1', 'f', 't']],
  ['getCampaignMediaAnalytics', '_analytics', 'getCampaignMediaAnalytics', ['c1', 'f', 't']],
  ['getAnalyticsSummary', '_analytics', 'getAnalyticsSummary', ['f', 't', 's']],
  ['getMediaUsage', '_analytics', 'getMediaUsage', ['m1']],
  ['getMediaUsageSummary', '_analytics', 'getMediaUsageSummary', [['m1', 'm2']]],
  // Campaigns
  ['duplicateCampaign', '_campaigns', 'duplicateCampaign', ['c1', { name: 'n' }]],
  ['deleteCampaign', '_campaigns', 'deleteCampaign', ['c1', { purgeAnalytics: true }]],
  ['moveCampaign', '_campaigns', 'moveCampaign', ['c1', 2]],
  ['batchCampaigns', '_campaigns', 'batchCampaigns', ['archive', ['c1'], {}]],
  ['addCampaignMediaBatch', '_campaigns', 'addCampaignMediaBatch', ['c1', []]],
  ['exportCampaign', '_campaigns', 'exportCampaign', ['c1']],
  ['importCampaign', '_campaigns', 'importCampaign', [{ campaign: {} }]],
  ['importCampaignBinary', '_campaigns', 'importCampaignBinary', [new File(['x'], 'c.zip')]],
  ['listCampaignCategories', '_campaigns', 'listCampaignCategories', []],
  ['createCampaignCategory', '_campaigns', 'createCampaignCategory', ['n', 's']],
  ['updateCampaignCategory', '_campaigns', 'updateCampaignCategory', ['id', { name: 'n' }]],
  ['deleteCampaignCategory', '_campaigns', 'deleteCampaignCategory', ['id']],
  ['listCampaignTags', '_campaigns', 'listCampaignTags', []],
  ['createCampaignTag', '_campaigns', 'createCampaignTag', ['n', 's']],
  ['deleteCampaignTag', '_campaigns', 'deleteCampaignTag', ['id']],
  ['listCampaignTemplates', '_campaigns', 'listCampaignTemplates', []],
  ['createCampaignTemplate', '_campaigns', 'createCampaignTemplate', [{ name: 'n' }]],
  ['deleteCampaignTemplate', '_campaigns', 'deleteCampaignTemplate', ['id']],
  ['listMediaTags', '_campaigns', 'listMediaTags', []],
  ['createMediaTag', '_campaigns', 'createMediaTag', ['n', 's']],
  ['deleteMediaTag', '_campaigns', 'deleteMediaTag', ['id']],
  ['submitAccessRequest', '_campaigns', 'submitAccessRequest', ['c1', 'a@b.c']],
  ['listAccessRequests', '_campaigns', 'listAccessRequests', ['c1', 'pending']],
  ['approveAccessRequest', '_campaigns', 'approveAccessRequest', ['c1', 'tok']],
  ['denyAccessRequest', '_campaigns', 'denyAccessRequest', ['c1', 'tok']],
  ['getAccessSummary', '_campaigns', 'getAccessSummary', [1, 50]],
  // Admin
  ['listWpPages', '_admin', 'listWpPages', []],
  ['getHealthData', '_admin', 'getHealthData', []],
  ['downloadGlobalAuditCsv', '_admin', 'downloadGlobalAuditCsv', [{ from: 'f' }]],
  // Webhooks (facade name differs from sub-API name)
  ['listWebhookEndpoints', '_webhooks', 'listEndpoints', []],
  ['createWebhookEndpoint', '_webhooks', 'createEndpoint', [{ url: 'u' }]],
  ['updateWebhookEndpoint', '_webhooks', 'updateEndpoint', [0, { url: 'u' }]],
  ['deleteWebhookEndpoint', '_webhooks', 'deleteEndpoint', [0]],
  ['rotateWebhookSecret', '_webhooks', 'rotateSecret', [0]],
  ['listWebhookDeliveries', '_webhooks', 'listDeliveries', [10]],
  // Binary export
  ['startCampaignBinaryExport', '_export', 'startCampaignBinaryExport', ['c1']],
  ['startBulkBinaryExport', '_export', 'startBulkBinaryExport', [['c1']]],
  ['startAuditLogBinaryExport', '_export', 'startAuditLogBinaryExport', [{ from: 'f' }]],
  ['startMediaLibraryBinaryExport', '_export', 'startMediaLibraryBinaryExport', [{}]],
  ['importMediaLibraryBinary', '_export', 'importMediaLibraryBinary', [new File(['x'], 'm.zip')]],
  ['getExportJob', '_export', 'getExportJob', ['j1']],
  ['deleteExportJob', '_export', 'deleteExportJob', ['j1']],
  ['downloadExportJob', '_export', 'downloadExportJob', ['j1', 'file.zip']],
];

describe('ApiClient delegation', () => {
  it.each(cases)('%s forwards to %s.%s', async (facade, field, method, args) => {
    const client = new ApiClient({ baseUrl });
    const sub = (client as unknown as Record<string, Record<string, unknown>>)[field]!;
    const sentinel = Promise.resolve(`ret:${String(facade)}`);
    const spy = vi.spyOn(sub as never, method as never).mockReturnValue(sentinel as never);

    const result = (client as unknown as Record<string, (...a: unknown[]) => unknown>)[
      facade as string
    ]!(...args);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(...args);
    expect(result).toBe(sentinel);
  });

  it('covers all 59 facade delegation methods', () => {
    expect(cases).toHaveLength(59);
  });
});
