import { describe, expect, it } from 'vitest';

import { getWpsgDebugProps, getWpsgDebugSlotAttributes } from './wpsgDebug';

describe('wpsgDebug', () => {
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
});