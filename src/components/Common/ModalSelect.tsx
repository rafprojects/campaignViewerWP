import { Select, type SelectProps } from '@mantine/core';

export function ModalSelect(props: SelectProps) {
  const { comboboxProps, ...restSelectProps } = props;

  return (
    <Select
      comboboxProps={{ ...comboboxProps, withinPortal: false }}
      {...restSelectProps}
    />
  );
}