import { type ReactElement, type PropsWithChildren, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MantineProvider, mergeThemeOverrides } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { createTestQueryClient } from '@/services/queryClient';
import { theme } from '../theme';

// P62-H: mirror the app's global a11y component defaults (see main.tsx) so component-level
// axe tests reflect the real render — notably the Mantine CloseButton accessible name that
// main.tsx layers on at runtime. Without this the base theme leaves it unlabeled in tests.
const testTheme = mergeThemeOverrides(theme, {
  components: {
    CloseButton: { defaultProps: { 'aria-label': 'Close' } },
  },
});

function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(createTestQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={testTheme} env="test">
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

const renderWithProviders = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: Providers, ...options });

export * from '@testing-library/react';
export { renderWithProviders as render };
