import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { colorInputPropsSpy } = vi.hoisted(() => ({
  colorInputPropsSpy: vi.fn(),
}));

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');

  return {
    ...actual,
    ColorInput: ({
      label,
      value,
      onChange,
      popoverProps,
    }: {
      label?: ReactNode;
      value?: string;
      onChange?: (value: string) => void;
      popoverProps?: { withinPortal?: boolean };
    }) => (
      (colorInputPropsSpy({ popoverProps }),
      <label>
        {label ? <span>{label}</span> : null}
        <input
          aria-label={typeof label === 'string' ? label : 'Color'}
          data-within-portal={String(popoverProps?.withinPortal)}
          value={value ?? ''}
          onChange={(event) => onChange?.(event.currentTarget.value)}
        />
      </label>)
    ),
  };
});

import { ModalColorInput } from './ModalColorInput';

function wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('ModalColorInput', () => {
  beforeEach(() => {
    colorInputPropsSpy.mockReset();
  });

  it('keeps popover rendering inside the current modal tree', () => {
    render(
      <ModalColorInput label="Background Color" value="#ff0000" />,
      { wrapper },
    );

    expect(colorInputPropsSpy).toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveAttribute('data-within-portal', 'false');
  });

  it('does not allow caller popover props to re-enable portal rendering', () => {
    render(
      <ModalColorInput
        label="Background Color"
        value="#ff0000"
        popoverProps={{ withinPortal: true }}
      />,
      { wrapper },
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('data-within-portal', 'false');
  });
});
