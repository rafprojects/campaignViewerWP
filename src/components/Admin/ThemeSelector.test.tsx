import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../../contexts/ThemeContext';

// We need to import ThemeSelector *after* mocks if any, but ThemeSelector
// uses useTheme which uses ThemeContext — we wrap in ThemeProvider.
import { ThemeSelector } from './ThemeSelector';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <MantineProvider>{children}</MantineProvider>
    </ThemeProvider>
  );
}

describe('ThemeSelector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders a Select with default label', () => {
    render(<ThemeSelector />, { wrapper });

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(
      screen.getByText('Choose a color theme. Changes apply instantly.'),
    ).toBeInTheDocument();
  });

  it('renders with custom label and description', () => {
    render(<ThemeSelector label="Color" description="Pick one" />, { wrapper });

    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('renders a textbox input for the theme select', () => {
    render(<ThemeSelector />, { wrapper });

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    // The current theme value should be set
    expect((input as HTMLInputElement).value.length).toBeGreaterThan(0);
  });
});
