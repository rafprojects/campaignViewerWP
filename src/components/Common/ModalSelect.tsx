import { Select, type SelectProps } from '@mantine/core';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export function ModalSelect(props: SelectProps) {
  const { comboboxProps, ...restSelectProps } = props;

  return (
    <Select
      comboboxProps={{ ...comboboxProps, withinPortal: false }}
      {...restSelectProps}
    />
  );
}

setWpsgDebugDisplayName(ModalSelect, 'ModalSelect');