/**
 * Branch-coverage tests for useRecordAnalyticsEvent.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecordAnalyticsEvent } from './useRecordAnalyticsEvent';
import type { ApiClient } from '@/services/apiClient';

function makeApiClient() {
  return {
    recordAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as ApiClient;
}

describe('useRecordAnalyticsEvent', () => {
  it('is a no-op when apiClient is undefined', () => {
    const { result } = renderHook(() => useRecordAnalyticsEvent(undefined));
    // Should not throw
    act(() => result.current('campaign-1', 'view'));
  });

  it('is a no-op when campaignId is empty', () => {
    const api = makeApiClient();
    const { result } = renderHook(() => useRecordAnalyticsEvent(api));
    act(() => result.current('', 'view'));
    expect(api.recordAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('records a view event with default eventType', () => {
    const api = makeApiClient();
    const { result } = renderHook(() => useRecordAnalyticsEvent(api));
    act(() => result.current('camp-1'));
    expect(api.recordAnalyticsEvent).toHaveBeenCalledWith('camp-1', 'view', undefined);
  });

  it('records a lightbox_open event with optional mediaId', () => {
    const api = makeApiClient();
    const { result } = renderHook(() => useRecordAnalyticsEvent(api));
    act(() => result.current('camp-1', 'lightbox_open', 'media-42'));
    expect(api.recordAnalyticsEvent).toHaveBeenCalledWith('camp-1', 'lightbox_open', 'media-42');
  });

  it('swallows API errors silently', async () => {
    const api = {
      recordAnalyticsEvent: vi.fn().mockRejectedValue(new Error('Network error')),
    } as unknown as ApiClient;
    const { result } = renderHook(() => useRecordAnalyticsEvent(api));
    await expect(async () => {
      act(() => result.current('camp-1', 'view'));
      await new Promise((r) => setTimeout(r, 10));
    }).not.toThrow();
  });
});
