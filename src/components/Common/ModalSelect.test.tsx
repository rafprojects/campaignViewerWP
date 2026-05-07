import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { selectPropsSpy } = vi.hoisted(() => ({
  selectPropsSpy: vi.fn(),
}));

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');

  return {
    ...actual,
    Select: ({
      label,
      value,
      onChange,
      data,
      comboboxProps,
    }: {
      label?: ReactNode;
      value?: string | null;
      onChange?: (nextValue: string | null) => void;
      data: Array<{ value: string; label: string }>;
      comboboxProps?: { withinPortal?: boolean };
    }) => (
      (selectPropsSpy({ comboboxProps }),
      <label>
        {label ? <span>{label}</span> : null}
        <select
          aria-label={typeof label === 'string' ? label : 'Modal Select'}
          data-within-portal={String(comboboxProps?.withinPortal)}
          value={value ?? ''}
          onChange={(event) => onChange?.(event.currentTarget.value || null)}
        >
          {data.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>)
    ),
  };
});

import { ModalSelect } from './ModalSelect';

function wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('ModalSelect', () => {
  beforeEach(() => {
    selectPropsSpy.mockReset();
  });

  it('keeps dropdown rendering inside the current modal tree', () => {
    render(
      <ModalSelect
        label="Gallery Mode"
        data={[{ value: 'unified', label: 'Unified' }]}
        value="unified"
      />,
      { wrapper },
    );

    expect(selectPropsSpy).toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveAttribute('data-within-portal', 'false');
  });

  it('does not allow caller combobox props to re-enable portal rendering', () => {
    render(
      <ModalSelect
        label="Gallery Mode"
        data={[{ value: 'unified', label: 'Unified' }]}
        value="unified"
        comboboxProps={{ withinPortal: true }}
      />,
      { wrapper },
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('data-within-portal', 'false');
  });
});