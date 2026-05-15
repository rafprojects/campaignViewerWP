import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        // Suppress aggressive refetch on window focus for all queries by default.
        // Expensive admin queries (campaigns, media, audit, analytics) explicitly
        // keep both focus + reconnect off. The single public campaigns query in
        // App.tsx intentionally enables reconnect:true to refresh after offline.
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}