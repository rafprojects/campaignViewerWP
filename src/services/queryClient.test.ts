import { describe, expect, it } from 'vitest';
import { createAppQueryClient, createTestQueryClient } from './queryClient';

describe('queryClient', () => {
  it('createAppQueryClient returns a configured QueryClient', () => {
    const client = createAppQueryClient();
    expect(client).toBeDefined();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(2);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(0);
  });

  it('createTestQueryClient returns a test-optimized QueryClient', () => {
    const client = createTestQueryClient();
    expect(client).toBeDefined();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(false);
    expect(defaults.queries?.gcTime).toBe(0);
    expect(defaults.mutations?.retry).toBe(false);
  });
});
