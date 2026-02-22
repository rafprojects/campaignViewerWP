import { type ReactElement, type PropsWithChildren } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { SWRConfig } from 'swr';
import { theme } from '../theme';

function Providers({ children }: PropsWithChildren) {
  return (
    // P13-C: SWRConfig with a fresh Map cache per test prevents cross-test
    // cache pollution. `dedupingInterval: 0` disables SWR's 2s dedup window
    // so tests don't get stale responses from earlier renders.
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MantineProvider theme={theme}>
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </SWRConfig>
  );
}

const renderWithProviders = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: Providers, ...options });

export * from '@testing-library/react';
export { renderWithProviders as render };
