import { afterEach, describe, expect, it } from 'vitest';

import { getWpsgDebugProps, getWpsgDebugSlotAttributes } from './wpsgDebug';

describe('wpsgDebug', () => {
  afterEach(() => {
    delete window.__WPSG_CONFIG__;
  });

  it('emits component markers when enabled', () => {
    expect(getWpsgDebugProps('CampaignViewer', undefined, true)).toEqual({
      'data-wpsg-component': 'CampaignViewer',
    });
  });

  it('emits component and slot markers when enabled', () => {
    expect(getWpsgDebugProps('CampaignViewer', 'content', true)).toEqual({
      'data-wpsg-component': 'CampaignViewer',
      'data-wpsg-slot': 'content',
    });
  });

  it('returns empty props when disabled', () => {
    expect(getWpsgDebugProps('CampaignViewer', 'content', false)).toEqual({});
  });

  it('uses the runtime config flag for default component markers', () => {
    window.__WPSG_CONFIG__ = { debugComponentMarkers: true };

    expect(getWpsgDebugProps('CampaignViewer', 'content')).toEqual({
      'data-wpsg-component': 'CampaignViewer',
      'data-wpsg-slot': 'content',
    });
  });

  it('maps Mantine slot keys to debug attributes when enabled', () => {
    expect(
      getWpsgDebugSlotAttributes(
        'ConfirmModal',
        { content: 'content', body: 'body' },
        true,
      ),
    ).toEqual({
      content: {
        'data-wpsg-component': 'ConfirmModal',
        'data-wpsg-slot': 'content',
      },
      body: {
        'data-wpsg-component': 'ConfirmModal',
        'data-wpsg-slot': 'body',
      },
    });
  });

  it('omits slot attributes entirely when disabled', () => {
    expect(getWpsgDebugSlotAttributes('ConfirmModal', { content: 'content' }, false)).toBeUndefined();
  });

  it('uses the runtime config flag for default slot attributes', () => {
    window.__WPSG_CONFIG__ = { debugComponentMarkers: true };

    expect(getWpsgDebugSlotAttributes('ConfirmModal', { content: 'content' })).toEqual({
      content: {
        'data-wpsg-component': 'ConfirmModal',
        'data-wpsg-slot': 'content',
      },
    });
  });
});