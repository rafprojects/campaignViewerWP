import { afterEach, describe, expect, it } from 'vitest';

import { getMullionDebugProps, getMullionDebugSlotAttributes, setMullionDebugDisplayName } from './mullionDebug';

describe('mullionDebug', () => {
  afterEach(() => {
    delete window.__MULLION_CONFIG__;
  });

  it('emits component markers when enabled', () => {
    expect(getMullionDebugProps('CampaignViewer', undefined, true)).toEqual({
      'data-mullion-component': 'CampaignViewer',
    });
  });

  it('emits component and slot markers when enabled', () => {
    expect(getMullionDebugProps('CampaignViewer', 'content', true)).toEqual({
      'data-mullion-component': 'CampaignViewer',
      'data-mullion-slot': 'content',
    });
  });

  it('returns empty props when disabled', () => {
    expect(getMullionDebugProps('CampaignViewer', 'content', false)).toEqual({});
  });

  it('uses the runtime config flag for default component markers', () => {
    window.__MULLION_CONFIG__ = { debugComponentMarkers: true };

    expect(getMullionDebugProps('CampaignViewer', 'content')).toEqual({
      'data-mullion-component': 'CampaignViewer',
      'data-mullion-slot': 'content',
    });
  });

  it('maps Mantine slot keys to debug attributes when enabled', () => {
    expect(
      getMullionDebugSlotAttributes(
        'ConfirmModal',
        { content: 'content', body: 'body' },
        true,
      ),
    ).toEqual({
      content: {
        'data-mullion-component': 'ConfirmModal',
        'data-mullion-slot': 'content',
      },
      body: {
        'data-mullion-component': 'ConfirmModal',
        'data-mullion-slot': 'body',
      },
    });
  });

  it('omits slot attributes entirely when disabled', () => {
    expect(getMullionDebugSlotAttributes('ConfirmModal', { content: 'content' }, false)).toBeUndefined();
  });

  it('uses the runtime config flag for default slot attributes', () => {
    window.__MULLION_CONFIG__ = { debugComponentMarkers: true };

    expect(getMullionDebugSlotAttributes('ConfirmModal', { content: 'content' })).toEqual({
      content: {
        'data-mullion-component': 'ConfirmModal',
        'data-mullion-slot': 'content',
      },
    });
  });

  it('uses the runtime config flag for explicit display names', () => {
    window.__MULLION_CONFIG__ = { debugComponentMarkers: true };

    expect(setMullionDebugDisplayName({}, 'GridCard')).toEqual({ displayName: 'GridCard' });
  });

  it('clears explicit display names when debug metadata is disabled', () => {
    expect(setMullionDebugDisplayName({ displayName: 'OldName' }, 'GridCard', false)).toEqual({
      displayName: undefined,
    });
  });
});